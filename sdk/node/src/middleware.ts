import type { NextFunction, Request, Response } from "express";
import { createClient } from "./client.js";
import type { CaptureEvent, DevReplayOptions, JsonValue, ResolvedDevReplayOptions } from "./types.js";

const CAPTURE_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-devreplay-api-key",
]);

const SENSITIVE_BODY_FIELDS = new Set([
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "secret",
  "apikey",
]);

const DEFAULT_MAX_BODY_SIZE = 64 * 1024;
const DEFAULT_UPLOAD_TIMEOUT_MS = 2000;

export function resolveOptions(options: DevReplayOptions): ResolvedDevReplayOptions {
  const apiKey = typeof options.apiKey === "string" ? options.apiKey.trim() : "";
  const endpoint = typeof options.endpoint === "string" ? options.endpoint.trim() : "";
  const excludePaths = normalizeExcludePaths(options.excludePaths);
  const maxBodySize =
    typeof options.maxBodySize === "number" && Number.isFinite(options.maxBodySize) && options.maxBodySize > 0
      ? Math.floor(options.maxBodySize)
      : DEFAULT_MAX_BODY_SIZE;
  const uploadTimeoutMs =
    typeof options.uploadTimeoutMs === "number" &&
    Number.isFinite(options.uploadTimeoutMs) &&
    options.uploadTimeoutMs > 0
      ? Math.floor(options.uploadTimeoutMs)
      : DEFAULT_UPLOAD_TIMEOUT_MS;

  return {
    apiKey,
    endpoint,
    excludePaths,
    maxBodySize,
    uploadTimeoutMs,
    enabled: options.enabled !== false,
    logger: options.logger ?? console,
  };
}

function normalizeExcludePaths(paths: string[] | undefined): string[] {
  const base = paths && paths.length > 0 ? paths : ["/ingest"];
  const normalized = base
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => (p.startsWith("/") ? p : `/${p}`));

  if (!normalized.some((p) => p === "/ingest" || p === "/ingest/*")) {
    normalized.push("/ingest");
  }

  return Array.from(new Set(normalized));
}

export function createDevReplayMiddleware(options: DevReplayOptions) {
  const resolved = resolveOptions(options);
  const client = createClient(resolved);

  if (!resolved.apiKey) {
    resolved.logger.warn("[DevReplay] Missing API key; capture uploads are disabled.");
  }
  if (!resolved.endpoint) {
    resolved.logger.warn("[DevReplay] Missing endpoint; capture uploads are disabled.");
  }

  return function devReplayMiddleware(req: Request, res: Response, next: NextFunction): void {
    try {
      if (!shouldCaptureRequest(req, resolved)) {
        next();
        return;
      }

      // Avoid capturing multipart/binary request bodies in initial implementation.
      if (isMultipartRequest(req)) {
        next();
        return;
      }

      const startTime = Date.now();
      const capturedRequestBody = sanitizeRequestBody(req.body, resolved.maxBodySize);
      const capturedQuery = sanitizeQuery(req.query);
      let responsePayload: unknown = undefined;
      let responsePayloadSet = false;

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalEnd = res.end.bind(res);

      res.json = ((body: unknown) => {
        responsePayload = body;
        responsePayloadSet = true;
        return originalJson(body);
      }) as Response["json"];

      res.send = ((body: unknown) => {
        responsePayload = body;
        responsePayloadSet = true;
        return originalSend(body as any);
      }) as Response["send"];

      res.end = ((chunk?: any, encoding?: any, cb?: any) => {
        if (!responsePayloadSet && chunk !== undefined && chunk !== null) {
          // Capture only if likely text/json and no prior json/send captured.
          responsePayload = chunk;
          responsePayloadSet = true;
        }
        return originalEnd(chunk, encoding as any, cb as any);
      }) as Response["end"];

      res.on("finish", () => {
        try {
          const durationMs = Math.max(0, Date.now() - startTime);
          const event: CaptureEvent = {
            method: req.method.toUpperCase(),
            path: req.path || "/",
            headers: redactHeaders(req.headers),
            query: capturedQuery,
            body: capturedRequestBody,
            statusCode: res.statusCode,
            responseBody: sanitizeResponseBody(responsePayload, res.getHeader("content-type"), resolved.maxBodySize),
            durationMs,
          };

          client.send(event);
        } catch (error) {
          safeWarn(resolved, "Failed to prepare capture event", error);
        }
      });

      next();
    } catch (error) {
      safeWarn(resolved, "Middleware error; request passed through", error);
      next();
    }
  };
}

export function shouldCaptureRequest(req: Request, options: ResolvedDevReplayOptions): boolean {
  if (!options.enabled) return false;
  const method = req.method.toUpperCase();
  if (!CAPTURE_METHODS.has(method)) return false;

  const path = req.path || "";
  if (!path) return false;
  if (isPathExcluded(path, options.excludePaths)) return false;
  return true;
}

function isPathExcluded(path: string, excludePaths: string[]): boolean {
  for (const rule of excludePaths) {
    if (rule.endsWith("/*")) {
      const prefix = rule.slice(0, -1); // keep trailing slash
      const base = rule.slice(0, -2);
      if (path === base || path.startsWith(prefix)) return true;
    } else if (path === rule) {
      return true;
    }
  }
  return false;
}

function isMultipartRequest(req: Request): boolean {
  const ct = String(req.headers["content-type"] ?? "").toLowerCase();
  return ct.includes("multipart/form-data") || ct.includes("application/octet-stream");
}

export function redactHeaders(headers: Request["headers"] | undefined): Record<string, JsonValue> | undefined {
  if (!headers || typeof headers !== "object") return undefined;
  const out: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else if (Array.isArray(value)) {
      out[key] = value.map((v) => String(v));
    } else {
      out[key] = String(value);
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

export function sanitizeQuery(query: unknown): Record<string, JsonValue> | undefined {
  const redacted = redactAndClone(query, new WeakSet(), 0);
  if (!redacted || typeof redacted !== "object" || Array.isArray(redacted)) return undefined;
  return redacted as Record<string, JsonValue>;
}

export function sanitizeRequestBody(body: unknown, maxBodySize: number): JsonValue | undefined {
  if (body === undefined) return undefined;
  if (isUnsafeBinaryBody(body)) return "[BINARY_BODY_OMITTED]";
  const redacted = redactAndClone(body, new WeakSet(), 0);
  if (redacted === undefined) return undefined;
  return applyBodyLimit(redacted, maxBodySize);
}

export function sanitizeResponseBody(
  body: unknown,
  contentTypeHeader: string | number | string[] | undefined,
  maxBodySize: number,
): JsonValue | undefined {
  if (body === undefined || body === null) {
    return body as null | undefined;
  }

  const contentType = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join(";").toLowerCase()
    : String(contentTypeHeader ?? "").toLowerCase();

  if (Buffer.isBuffer(body)) {
    if (!isTextualContentType(contentType)) return "[BINARY_BODY_OMITTED]";
    const text = body.toString("utf8");
    if (contentType.includes("application/json") || contentType.includes("+json") || looksLikeJson(text)) {
      try {
        const parsed = JSON.parse(text);
        const redacted = redactAndClone(parsed, new WeakSet(), 0);
        return redacted === undefined ? undefined : applyBodyLimit(redacted, maxBodySize);
      } catch {
        // fall through to plain text handling
      }
    }
    return applyBodyLimit(text, maxBodySize);
  }

  if (typeof body === "string") {
    // res.send('text') / res.end('text')
    if (contentType && !isTextualContentType(contentType)) return "[BINARY_BODY_OMITTED]";
    // If it looks like JSON, try to parse so we can redact nested sensitive fields.
    if (contentType.includes("application/json") || contentType.includes("+json") || looksLikeJson(body)) {
      try {
        const parsed = JSON.parse(body);
        const redacted = redactAndClone(parsed, new WeakSet(), 0);
        return redacted === undefined ? undefined : applyBodyLimit(redacted, maxBodySize);
      } catch {
        return applyBodyLimit(body, maxBodySize);
      }
    }
    return applyBodyLimit(body, maxBodySize);
  }

  if (isUnsafeBinaryBody(body)) return "[BINARY_BODY_OMITTED]";

  if (
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    contentType.includes("text/") ||
    contentType === "" ||
    typeof body === "object"
  ) {
    const redacted = redactAndClone(body, new WeakSet(), 0);
    if (redacted === undefined) return undefined;
    return applyBodyLimit(redacted, maxBodySize);
  }

  if (typeof body === "number" || typeof body === "boolean") {
    return body;
  }

  return "[UNSUPPORTED_RESPONSE_BODY_OMITTED]";
}

function isTextualContentType(contentType: string): boolean {
  if (!contentType) return false;
  return (
    contentType.includes("text/") ||
    contentType.includes("application/json") ||
    contentType.includes("+json") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/javascript") ||
    contentType.includes("application/x-www-form-urlencoded")
  );
}

function looksLikeJson(value: string): boolean {
  const t = value.trim();
  return (t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"));
}

function isUnsafeBinaryBody(value: unknown): boolean {
  if (Buffer.isBuffer(value)) return true;
  if (value instanceof ArrayBuffer) return true;
  if (ArrayBuffer.isView(value)) return true;
  if (typeof value === "object" && value !== null) {
    const v = value as Record<string, unknown>;
    // Streams / file-like objects
    if (typeof v.pipe === "function" && typeof v.on === "function") return true;
  }
  return false;
}

export function redactAndClone(value: unknown, seen: WeakSet<object>, depth: number): JsonValue | undefined {
  if (depth > 20) return "[MAX_DEPTH_REACHED]";
  if (value === null) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value as string | boolean;
  if (t === "number") return Number.isFinite(value as number) ? (value as number) : String(value);
  if (t === "bigint") return (value as bigint).toString();
  if (t === "undefined" || t === "function" || t === "symbol") return undefined;

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return "[BINARY_BODY_OMITTED]";
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return "[BINARY_BODY_OMITTED]";

  if (Array.isArray(value)) {
    return value.map((item) => {
      const redacted = redactAndClone(item, seen, depth + 1);
      return redacted === undefined ? null : redacted;
    });
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return "[CIRCULAR]";
    seen.add(obj);

    const out: Record<string, JsonValue> = {};
    for (const [key, child] of Object.entries(obj)) {
      if (SENSITIVE_BODY_FIELDS.has(key.toLowerCase())) {
        out[key] = "[REDACTED]";
        continue;
      }
      const redactedChild = redactAndClone(child, seen, depth + 1);
      if (redactedChild !== undefined) {
        out[key] = redactedChild;
      }
    }
    return out;
  }

  try {
    return String(value);
  } catch {
    return undefined;
  }
}

export function applyBodyLimit(value: JsonValue, maxBodySize: number): JsonValue {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return "[UNSERIALIZABLE_BODY]";
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes <= maxBodySize) return value;

    const previewLimit = Math.max(0, Math.min(maxBodySize, 512));
    const preview = truncateUtf8(serialized, previewLimit);
    return {
      __devreplay_truncated: true,
      message: "Payload exceeded maxBodySize and was truncated",
      originalBytes: bytes,
      maxBodySize,
      preview,
    };
  } catch {
    return "[UNSERIALIZABLE_BODY]";
  }
}

function truncateUtf8(input: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  let bytes = 0;
  let out = "";
  for (const char of input) {
    const charBytes = Buffer.byteLength(char, "utf8");
    if (bytes + charBytes > maxBytes) break;
    out += char;
    bytes += charBytes;
  }
  return out;
}

function safeWarn(options: ResolvedDevReplayOptions, message: string, error?: unknown): void {
  try {
    if (error instanceof Error) {
      options.logger.warn(`[DevReplay] ${message}: ${error.message}`);
    } else if (error !== undefined) {
      options.logger.warn(`[DevReplay] ${message}: ${String(error)}`);
    } else {
      options.logger.warn(`[DevReplay] ${message}`);
    }
  } catch {
    // ignore
  }
}
