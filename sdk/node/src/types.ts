import type { Request, RequestHandler } from "express";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface DevReplayOptions {
  apiKey: string;
  endpoint: string;
  /** Paths to exclude from capture. Supports exact paths ("/health") and prefix wildcards ("/internal/*"). Defaults to ["/ingest"]. */
  excludePaths?: string[];
  /** Max bytes for captured request/response bodies and query payloads before truncation. Defaults to 65536. */
  maxBodySize?: number;
  /** Upload timeout in milliseconds. Defaults to 2000. */
  uploadTimeoutMs?: number;
  /** Max concurrent batch uploads. If omitted, falls back to `maxConcurrentUploads`. Defaults to 2. */
  maxConcurrentBatchUploads?: number;
  /** Legacy alias for concurrent upload limit; integrated as batch upload concurrency for backward compatibility. */
  maxConcurrentUploads?: number;
  /** Max number of events buffered in memory. Defaults to 1000. */
  maxQueueSize?: number;
  /** Max events per batch upload. Defaults to 50. */
  maxBatchSize?: number;
  /** Periodic flush interval in milliseconds while events remain queued. Defaults to 5000. */
  flushIntervalMs?: number;
  /** Max retry attempts per batch/event delivery (including initial attempt). Defaults to 5. */
  maxRetryAttempts?: number;
  /** Base retry backoff delay in milliseconds. Defaults to 500. */
  retryBaseDelayMs?: number;
  /** Maximum retry backoff delay in milliseconds. Defaults to 30000. */
  retryMaxDelayMs?: number;
  /** Bounded timeout for flush/shutdown operations in milliseconds. Defaults to 10000. */
  shutdownTimeoutMs?: number;
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
  maxConcurrentBatchUploads: number;
  maxQueueSize: number;
  maxBatchSize: number;
  flushIntervalMs: number;
  maxRetryAttempts: number;
  retryBaseDelayMs: number;
  retryMaxDelayMs: number;
  shutdownTimeoutMs: number;
  enabled: boolean;
  logger: Pick<Console, "warn" | "error">;
}

export interface CaptureEvent {
  eventId?: string;
  method: string;
  path: string;
  headers?: Record<string, JsonValue>;
  query?: Record<string, JsonValue>;
  body?: JsonValue;
  statusCode?: number;
  responseBody?: JsonValue;
  durationMs?: number;
}

export interface DeliveryStats {
  totalCaptured: number;
  eventsQueued: number;
  eventsDelivered: number;
  eventsDropped: number;
  uploadFailures: number;
  retryAttempts: number;
  currentQueueSize: number;
  /** Number of batch upload attempts dispatched (includes retries and 413 splits). */
  batchCount: number;
}

export interface DevReplayClient {
  enqueue(event: CaptureEvent): void;
  /** Returns true if the queue drained within the timeout, false otherwise. */
  flush(timeoutMs?: number): Promise<boolean>;
  /** Returns true if the queue drained within the timeout, false otherwise. */
  shutdown(timeoutMs?: number): Promise<boolean>;
  getStats(): DeliveryStats;
}

export interface DevReplayInstance {
  middleware(): RequestHandler;
  /** Returns true if the queue drained within the timeout, false otherwise. */
  flush(timeoutMs?: number): Promise<boolean>;
  /** Returns true if the queue drained within the timeout, false otherwise. */
  shutdown(timeoutMs?: number): Promise<boolean>;
  getStats(): DeliveryStats;
}

export type ExpressRequest = Request & { body?: unknown };
