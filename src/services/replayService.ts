import prisma from "../lib/prisma.js";
import { validateReplayBaseUrl, secureFetch } from "./replaySecurity.js";

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
    });
    status = result.status;
    responseHeaders = result.headers;
    const contentType = String(result.headers["content-type"] || "");
    if (contentType.includes("application/json")) {
      try {
        responseBody = JSON.parse(result.body);
      } catch {
        responseBody = result.body;
      }
    } else {
      responseBody = result.body;
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
        responseBody === undefined ? undefined : (responseBody as any),
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
