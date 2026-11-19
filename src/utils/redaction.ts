// Centralized redaction utilities for backend (replay responses, etc.)

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "proxy-authorization",
  "x-api-key",
  "x-devreplay-api-key",
]);

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
  "credentials",
  "sessiontoken",
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isSensitiveHeader(name: string): boolean {
  return SENSITIVE_HEADERS.has(name.toLowerCase());
}

export function redactHeaders(headers: unknown): Record<string, unknown> | undefined {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(headers as Record<string, unknown>)) {
    if (isSensitiveHeader(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function isSensitiveField(key: string): boolean {
  const normalized = normalizeKey(key);
  if (!normalized) return false;
  return SENSITIVE_BODY_FIELDS.has(normalized);
}

export function redactValue(value: unknown, seen: WeakSet<object> = new WeakSet(), depth = 0): unknown {
  if (depth > 20) return "[MAX_DEPTH_REACHED]";
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string" || t === "number" || t === "boolean") return value;
  if (t === "bigint") return (value as bigint).toString();
  if (t === "function" || t === "symbol" || t === "undefined") return undefined;

  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return "[BINARY_BODY_OMITTED]";

  if (Array.isArray(value)) {
    if (seen.has(value)) return "[CIRCULAR]";
    seen.add(value);
    try {
      return value.map((item) => redactValue(item, seen, depth + 1));
    } finally {
      seen.delete(value);
    }
  }

  if (t === "object") {
    const obj = value as Record<string, unknown>;
    if (seen.has(obj)) return "[CIRCULAR]";
    seen.add(obj);
    try {
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(obj)) {
        if (isSensitiveField(key)) {
          out[key] = "[REDACTED]";
        } else {
          const redacted = redactValue(child, seen, depth + 1);
          if (redacted !== undefined) out[key] = redacted;
        }
      }
      return out;
    } finally {
      seen.delete(obj);
    }
  }

  return String(value);
}

export function redactJsonString(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  try {
    const parsed = JSON.parse(trimmed);
    const redacted = redactValue(parsed);
    return JSON.stringify(redacted);
  } catch {
    // Non-JSON: cannot safely redact by key; return as-is (conservative).
    return text;
  }
}