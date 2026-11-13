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

// Normalized (lowercased, non-alphanumeric removed) sensitive body field names/variants.
const SENSITIVE_BODY_FIELDS = new Set([
  "password",
  "passwd",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "apikey",
  "secret",
  "clientsecret",
  "privatekey",
  "session",
  "sessionid",
  "csrftoken",
  "xsrf",
  "xsrftoken",
  "authorization",
]);

const DEFAULT_MAX_BODY_SIZE = 64 * 1024;
const DEFAULT_UPLOAD_TIMEOUT_MS = 2000;
const DEFAULT_MAX_CONCURRENT_UPLOADS = 5;

export function resolveOptions(options: DevReplayOptions): ResolvedDevReplayOptions {
  const apiKey = typeof options.apiKey === "string" ? options.apiKey.trim() : "";
  const rawEndpoint = typeof options.endpoint === "string" ? options.endpoint.trim() : "";
  const endpoint = normalizeEndpoint(rawEndpoint);
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
  const maxConcurrentUploads =
    typeof options.maxConcurrentUploads === "number" &&
    Number.isFinite(options.maxConcurrentUploads) &&
    options.maxConcurrentUploads > 0
      ? Math.floor(options.maxConcurrentUploads)
      : DEFAULT_MAX_CONCURRENT_UPLOADS;

  const logger = options.logger ?? console;
  if (rawEndpoint && !endpoint) {
    safeWarnWithLogger(logger, "Invalid endpoint URL; capture uploads are disabled");
  }

  return {
    apiKey,
    endpoint,
    excludePaths,
    maxBodySize,
    uploadTimeoutMs,
    maxConcurrentUploads,
    enabled: options.enabled !== false,
    logger,
  };
}

function normalizeEndpoint(endpoint: string): string {
  if (!endpoint) return "";
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    // Keep pathname/search if provided, but uploads target `${endpoint}/ingest` in client by base trimming;
    // we store normalized origin+pathname without trailing slash for predictable concatenation.
    const normalized = url.toString().replace(/\/+$/, "");
    return normalized;
  } catch {
    return "";
  }
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
    // Warning may already have been emitted for invalid URL; emit a generic one only if truly empty input.
    if (!options.endpoint) {
      resolved.logger.warn("[DevReplay] Missing endpoint; capture uploads are disabled.");
    }
  }

  return function devReplayMiddleware(req: Request, res: Response, next: NextFunction): void {
    let nextCalled = false;
    const safeNext = (err?: unknown) => {
      if (nextCalled) return;
      nextCalled = true;
      if (err !== undefined) (next as any)(err);
      else next();
    };

    try {
      if (!shouldCaptureRequest(req, resolved)) {
        safeNext();
        return;
      }

      // Avoid capturing multipart/binary request bodies in initial implementation.
      if (isMultipartRequest(req)) {
        safeNext();
        return;
      }

      const startTime = Date.now();
      const capturedRequestBody = sanitizeRequestBody(req.body, resolved.maxBodySize);
      const capturedQuery = sanitizeQuery(req.query, resolved.maxBodySize);
      let responsePayload: unknown = undefined;
      let responseCaptureState: "none" | "single" | "stream" = "none";
      let finished = false;

      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);
      const originalEnd = res.end.bind(res);
      const originalWrite = res.write.bind(res);

      res.json = function patchedJson(this: Response, ...args: any[]) {
        if (responseCaptureState === "none") {
          responsePayload = args[0];
          responseCaptureState = "single";
        }
        return originalJson.apply(this, args as any);
      } as Response["json"];

      res.send = function patchedSend(this: Response, ...args: any[]) {
        if (responseCaptureState === "none") {
          responsePayload = args[0];
          responseCaptureState = "single";
        }
        return originalSend.apply(this, args as any);
      } as Response["send"];

      res.write = function patchedWrite(this: Response, ...args: any[]) {
        // If streaming via write(), we cannot safely capture the complete response body.
        if (responseCaptureState === "none") {
          responsePayload = "[STREAMED_RESPONSE_BODY_NOT_CAPTURED]";
          responseCaptureState = "stream";
        } else if (responseCaptureState === "single") {
          // A prior send/json followed by write is unusual, but treat as streamed/incomplete.
          responsePayload = "[STREAMED_RESPONSE_BODY_NOT_CAPTURED]";
          responseCaptureState = "stream";
        }
        return originalWrite.apply(this, args as any);
      } as Response["write"];

      res.end = function patchedEnd(this: Response, ...args: any[]) {
        const chunk = args[0];
        if (responseCaptureState === "none") {
          if (chunk !== undefined && chunk !== null && typeof chunk !== "function") {
            responsePayload = chunk;
            responseCaptureState = "single";
          }
        } else if (responseCaptureState === "stream") {
          // Keep marker; do not append/replace with potentially partial end chunk.
          responsePayload = "[STREAMED_RESPONSE_BODY_NOT_CAPTURED]";
        }
        return originalEnd.apply(this, args as any);
      } as Response["end"];

      res.on("finish", () => {
        if (finished) return;
        finished = true;
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

      safeNext();
    } catch (error) {
      safeWarn(resolved, "Middleware error; request passed through", error);
      safeNext();
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

export function sanitizeQuery(query: unknown, maxBodySize = DEFAULT_MAX_BODY_SIZE): Record<string, JsonValue> | undefined {
  const redacted = redactAndClone(query, new WeakSet(), 0);
  if (redacted === undefined) return undefined;

  // Apply size limit to query payloads too (best-effort, with safe serialization handling).
  const limited = applyPayloadLimit(redacted, maxBodySize);
  if (!limited || typeof limited !== "object" || Array.isArray(limited)) {
    // If truncation produced a marker object that's not a record in the usual query shape,
    // preserve a structured record so callers still receive a query object.
    if (limited && typeof limited === "object" && !Array.isArray(limited)) return limited as Record<string, JsonValue>;
    return undefined;
  }
  return limited as Record<string, JsonValue>;
}

export function sanitizeRequestBody(body: unknown, maxBodySize: number): JsonValue | undefined {
  if (body === undefined) return undefined;
  if (isUnsafeBinaryBody(body)) return "[BINARY_BODY_OMITTED]";
  const redacted = redactAndClone(body, new WeakSet(), 0);
  if (redacted === undefined) return undefined;
  return applyPayloadLimit(redacted, maxBodySize);
}

export function sanitizeResponseBody(
  body: unknown,
  contentTypeHeader: string | number | string[] | undefined,
  maxBodySize: number,
): JsonValue | undefined {
  if (body === undefined || body === null) {
    return body as null | undefined;
  }

  if (body === "[STREAMED_RESPONSE_BODY_NOT_CAPTURED]") {
    return body;
  }

  const contentType = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join(";").toLowerCase()
    : String(contentTypeHeader ?? "").toLowerCase();

  if (Buffer.isBuffer(body)) {
    if (!isTextualContentType(contentType)) return "[BINARY_BODY_OMITTED]";
    const text = body.toString("utf8");
    if (contentType.includes("application/json") || contentType.includes("+json") || looksLikeJson(text)) {
      const parsed = safeJsonParse(text);
      if (parsed.ok) {
        const redacted = redactAndClone(parsed.value, new WeakSet(), 0);
        return redacted === undefined ? undefined : applyPayloadLimit(redacted, maxBodySize);
      }
    }
    return applyPayloadLimit(text, maxBodySize);
  }

  if (typeof body === "string") {
    // res.send('text') / res.end('text')
    if (contentType && !isTextualContentType(contentType)) return "[BINARY_BODY_OMITTED]";
    // If it looks like JSON, try to parse so we can redact nested sensitive fields.
    if (contentType.includes("application/json") || contentType.includes("+json") || looksLikeJson(body)) {
      const parsed = safeJsonParse(body);
      if (parsed.ok) {
        const redacted = redactAndClone(parsed.value, new WeakSet(), 0);
        return redacted === undefined ? undefined : applyPayloadLimit(redacted, maxBodySize);
      }
      return applyPayloadLimit(body, maxBodySize);
    }
    return applyPayloadLimit(body, maxBodySize);
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
    return applyPayloadLimit(redacted, maxBodySize);
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

function isSensitiveBodyKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalized) return false;
  if (SENSITIVE_BODY_FIELDS.has(normalized)) return true;
  // Common exact-ish variants that normalize cleanly: access_token, refresh_token, api_key, client_secret, privateKey, session, etc.
  // Avoid broad substring matches to reduce false positives on ordinary fields.
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
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    try {
      return value.map((item) => {
        const redacted = redactAndClone(item, seen, depth + 1);
        return redacted === undefined ? null : redacted;
      });
    } finally {
      seen.delete(value);
    }
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return "[CIRCULAR]";
    seen.add(obj);
    try {
      const out: Record<string, JsonValue> = {};
      for (const [key, child] of Object.entries(obj)) {
        if (isSensitiveBodyKey(key)) {
          out[key] = "[REDACTED]";
          continue;
        }
        const redactedChild = redactAndClone(child, seen, depth + 1);
        if (redactedChild !== undefined) {
          out[key] = redactedChild;
        }
      }
      return out;
    } finally {
      seen.delete(obj);
    }
  }

  try {
    return String(value);
  } catch {
    return undefined;
  }
}

/**
 * Best-effort payload size limiting. Serialization/truncation here does not prevent
 * memory usage from the original in-memory payloads; callers should still avoid capturing
 * oversized/binary/streamed data where possible.
 */
export function applyPayloadLimit(value: JsonValue, maxBodySize: number): JsonValue {
  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) return "[UNSERIALIZABLE_PAYLOAD]";
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes <= maxBodySize) return value;

    const previewLimit = Math.max(0, Math.min(maxBodySize, 512));
    const preview = truncateUtf8(serialized, previewLimit);
    return {
      __devreplay_truncated: true,
      message: "Payload exceeded maxBodySize and was truncated for capture (best-effort)",
      originalBytes: bytes,
      maxBodySize,
      preview,
    };
  } catch {
    return "[UNSERIALIZABLE_PAYLOAD]";
  }
}

// Backward-compatible export name used by existing tests/code.
export const applyBodyLimit = applyPayloadLimit;

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

function safeJsonParse(text: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function safeWarn(options: ResolvedDevReplayOptions, message: string, error?: unknown): void {
  safeWarnWithLogger(options.logger, message, error);
}

function safeWarnWithLogger(logger: Pick<Console, "warn" | "error">, message: string, error?: unknown): void {
  try {
    if (error instanceof Error) {
      logger.warn(`[DevReplay] ${message}: ${error.message}`);
    } else if (error !== undefined) {
      logger.warn(`[DevReplay] ${message}: ${String(error)}`);
    } else {
      logger.warn(`[DevReplay] ${message}`);
    }
  } catch {
    // ignore
  }
}
