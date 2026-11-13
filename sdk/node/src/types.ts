import type { Request, RequestHandler } from "express";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface DevReplayOptions {
  apiKey: string;
  endpoint: string;
  /** Paths to exclude from capture. Supports exact paths ("/health") and prefix wildcards ("/internal/*"). Defaults to ["/ingest"]. */
  excludePaths?: string[];
  /** Max bytes for captured request/response bodies before truncation. Defaults to 65536. */
  maxBodySize?: number;
  /** Upload timeout in milliseconds. Defaults to 2000. */
  uploadTimeoutMs?: number;
  /** Enable/disable capture. Defaults to true. */
  enabled?: boolean;
  /** Optional logger for non-fatal SDK messages. */
  logger?: Pick<Console, "warn" | "error">;
}

export interface ResolvedDevReplayOptions {
  apiKey: string;
  endpoint: string;
  excludePaths: string[];
  maxBodySize: number;
  uploadTimeoutMs: number;
  enabled: boolean;
  logger: Pick<Console, "warn" | "error">;
}

export interface CaptureEvent {
  method: string;
  path: string;
  headers?: Record<string, JsonValue>;
  query?: Record<string, JsonValue>;
  body?: JsonValue;
  statusCode?: number;
  responseBody?: JsonValue;
  durationMs?: number;
}

export interface DevReplayClient {
  send(event: CaptureEvent): void;
}

export interface DevReplayInstance {
  middleware(): RequestHandler;
}

export type ExpressRequest = Request & { body?: unknown };
