import prisma from "../lib/prisma.js";
import { validateReplayBaseUrl, secureFetch } from "./replaySecurity.js";
import { redactHeaders, redactValue } from "../utils/redaction.js";

const HOP_BY_HOP = new Set([
  "host",
  "content-length",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "accept-encoding",
]);

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-devreplay-api-key",
]);

function filterHeaders(headers: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return out;
  for (const [k, v] of Object.entries(headers as Record<string, unknown>)) {
    const lower = k.toLowerCase();
    if (HOP_BY_HOP.has(lower) || SENSITIVE_HEADERS.has(lower)) continue;
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

export type ReplayExecutionResult = {
  status: number;
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
  replay: any;
  targetError: boolean;
  infraError: string | null;
};

/**
 * Whether replay requests may reach loopback addresses of the configured
 * replay target.
 *
 * - `NODE_ENV=development` (the explicit development signal) allows loopback
 *   targets on `localhost`, `127.0.0.1` and `::1`. Non-loopback hostnames are
 *   never opened by this condition, even in development mode.
 * - `REPLAY_ALLOW_LOOPBACK=true` is the explicit operator override and applies
 *   in any mode (including production). Security note: it lets a project
 *   owner replay against loopback addresses of their configured replay
 *   target (recorded status + redacted response body) — enable it only
 *   deliberately, never in production unless intended.
 *
 * Production blocks loopback by default: leave both unset/other modes to
 * keep it blocked unless the operator opts in explicitly.
 */
export function allowLoopbackForReplayTarget(
  hostname: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  // Windows `cmd`'s `set` keeps trailing whitespace in the value, so the
  // development signal is normalized: "development ", "development" all count.
  const nodeEnv = env.NODE_ENV?.trim();
  return (
    env.REPLAY_ALLOW_LOOPBACK === "true" ||
    (nodeEnv === "development" &&
      (hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "::1"))
  );
}

export async function executeReplay(
  requestId: string,
  ownerId: string,
): Promise<ReplayExecutionResult | null> {
  const requestLog = await prisma.requestLog.findFirst({
    where: {
      id: requestId,
      project: { is: { ownerId } },
    },
    include: { project: true },
  });

  if (!requestLog) return null;

  const project = requestLog.project as any;
  const baseUrl = validateReplayBaseUrl(project?.replayBaseUrl);
  if (!baseUrl) {
    throw new Error("Project replay target is not configured");
  }

  // Prevent captured absolute/protocol-relative paths from overriding the configured origin.
  const rawPath = typeof requestLog.path === "string" ? requestLog.path : "/";
  if (/^[a-z][a-z0-9+.-]*:/i.test(rawPath) || rawPath.startsWith("//")) {
    throw new Error("Invalid captured request path");
  }

  const target = new URL(baseUrl);
  // Use only the pathname portion of the captured path (no query).
  let pathname = "/";
  try {
    const parsed = new URL(rawPath, "http://placeholder");
    pathname = parsed.pathname || "/";
  } catch {
    throw new Error("Invalid captured request path");
  }
  target.pathname = pathname;

  // Apply captured query params without duplicating existing ones.
  target.search = "";
  if (requestLog.query && typeof requestLog.query === "object" && !Array.isArray(requestLog.query)) {
    for (const [key, value] of Object.entries(requestLog.query as Record<string, unknown>)) {
      target.searchParams.set(key, String(value));
    }
  }

  // Loopback replay targets are a normal dev setup; they are allowed only in
  // development mode (see allowLoopbackForReplayTarget).
  const allowLoopback = allowLoopbackForReplayTarget(target.hostname);

  const method = (requestLog.method || "GET").toUpperCase();
  const headers = filterHeaders(requestLog.headers);

  let body: string | undefined;
  if (method !== "GET" && method !== "HEAD" && requestLog.body !== null && requestLog.body !== undefined) {
    body = JSON.stringify(requestLog.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }

  const startTime = Date.now();
  let status = 0;
  let responseBody: unknown;
  let responseHeaders: Record<string, string | string[] | undefined> = {};
  let infraError: string | null = null;
  let targetError = false;

  try {
    const result = await secureFetch(target.toString(), {
      method,
      headers,
      body,
      maxBytes: 1024 * 1024,
      connectTimeoutMs: 5000,
      totalTimeoutMs: 15000,
      maxRedirects: 3,
      allowLoopback,
    });
    status = result.status;
    responseHeaders = result.headers;
    const contentType = String(result.headers["content-type"] || "").toLowerCase();
    const isJson = contentType.includes("application/json") || contentType.includes("+json");

    if (isJson) {
      try {
        const parsed = JSON.parse(result.body);
        responseBody = redactValue(parsed);
      } catch {
        // Malformed JSON: never store the raw body.
        responseBody = "[REDACTED: response body omitted because safe inspection is unsupported]";
      }
    } else {
      // Non-JSON/unknown/binary: do not persist raw content.
      responseBody = "[REDACTED: response body omitted because safe inspection is unsupported]";
    }
    if (status >= 400) targetError = true;
  } catch (error) {
    infraError = error instanceof Error ? error.message : "Replay failed";
    status = 0;
  }

  const durationMs = Date.now() - startTime;

  const replayExecution = await prisma.replayExecution.create({
    data: {
      requestLogId: requestId,
      statusCode: status || null,
      responseBody:
        responseBody === undefined
          ? infraError
            ? { error: infraError }
            : undefined
          : (responseBody as any),
      durationMs,
    },
  });

  return {
    status,
    body: responseBody,
    headers: responseHeaders,
    replay: replayExecution,
    targetError,
    infraError,
  };
}

export async function replayHistoryService(requestId: string, ownerId: string) {
  const requestLog = await prisma.requestLog.findFirst({
    where: { id: requestId, project: { is: { ownerId } } },
    select: { id: true },
  });
  if (!requestLog) return null;
  return prisma.replayExecution.findMany({
    where: { requestLogId: requestLog.id },
    orderBy: { createdAt: "desc" },
  });
}

export type ProjectReplayListItem = {
  id: string;
  requestLogId: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: Date;
  requestLog: {
    id: string;
    method: string;
    path: string;
  };
};

export type ProjectReplaysPage = {
  data: ProjectReplayListItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * List replay executions for a project, newest first.
 * Scoped by project owner so the dashboard can only see its own replays.
 */
export async function getProjectReplays(
  projectId: string,
  ownerId: string,
  page: number,
  limit: number,
): Promise<ProjectReplaysPage | null> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
    select: { id: true },
  });

  if (!project) {
    return null;
  }

  const where = { requestLog: { projectId: project.id } };

  const [data, total] = await Promise.all([
    prisma.replayExecution.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        requestLogId: true,
        statusCode: true,
        durationMs: true,
        createdAt: true,
        requestLog: {
          select: { id: true, method: true, path: true },
        },
      },
    }),
    prisma.replayExecution.count({ where }),
  ]);

  return {
    data,
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
