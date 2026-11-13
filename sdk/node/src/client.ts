import { randomUUID } from "node:crypto";
import type { CaptureEvent, DeliveryStats, ResolvedDevReplayOptions } from "./types.js";

type QueueItem = {
  event: CaptureEvent & { eventId: string };
  attempts: number; // number of completed upload attempts
  nextAttemptAt: number;
  enqueuedSeq: number;
};

type BatchItemResult = {
  eventId?: string;
  id?: string;
  duplicate?: boolean;
  error?: string;
  retryable?: boolean;
};

type BatchResponseBody = {
  message?: string;
  accepted?: number;
  duplicates?: number;
  failed?: number;
  results?: BatchItemResult[];
  error?: string;
  index?: number;
};

type UploadOutcome = {
  ok: boolean;
  retryable: boolean;
  status?: number;
  retryAfterMs?: number;
  ambiguous?: boolean;
  body?: BatchResponseBody | null;
};

const DEFAULT_STATS: DeliveryStats = {
  totalCaptured: 0,
  eventsQueued: 0,
  eventsDelivered: 0,
  eventsDropped: 0,
  uploadFailures: 0,
  retryAttempts: 0,
  currentQueueSize: 0,
  batchCount: 0,
};

// Keep below backend express.json limit (256kb in src/app.ts) to reduce 413s.
const MAX_BATCH_BYTES = 240 * 1024;

export function createClient(options: ResolvedDevReplayOptions) {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const ingestUrl = `${endpoint}/ingest`;
  const batchUrl = `${endpoint}/ingest/batch`;

  const queue: QueueItem[] = [];
  let seq = 0;
  let inFlightBatches = 0;
  let flushTimer: NodeJS.Timeout | null = null;
  let flushTimerAt: number | null = null;
  let activeFlush: Promise<boolean> | null = null;
  let accepting = true;
  let shutdownStarted = false;
  let batchEndpointUnsupported = false;

  const stats: DeliveryStats = { ...DEFAULT_STATS };

  function getStats(): DeliveryStats {
    return { ...stats, currentQueueSize: queue.length };
  }

  function enqueue(event: CaptureEvent): void {
    stats.totalCaptured += 1;

    if (!options.enabled || !options.apiKey || !options.endpoint) {
      return;
    }
    if (!accepting) {
      stats.eventsDropped += 1;
      safeWarn(options, "Dropping capture event: client is shutting down");
      return;
    }

    const eventWithId: CaptureEvent & { eventId: string } = {
      ...event,
      eventId: event.eventId || createEventId(),
    };

    if (queue.length >= options.maxQueueSize) {
      stats.eventsDropped += 1;
      safeWarn(options, "Dropping capture event: queue capacity reached");
      return;
    }

    queue.push({
      event: eventWithId,
      attempts: 0,
      nextAttemptAt: Date.now(),
      enqueuedSeq: seq++,
    });
    stats.eventsQueued += 1;
    scheduleProcessing(0);
  }

  async function flush(timeoutMs = options.shutdownTimeoutMs): Promise<boolean> {
    if (activeFlush) {
      const result = await withTimeout(activeFlush, timeoutMs).catch(() => false);
      return result === true;
    }

    const run = (async (): Promise<boolean> => {
      const deadline = Date.now() + Math.max(0, timeoutMs);
      while (Date.now() < deadline) {
        pump();
        if (queue.length === 0 && inFlightBatches === 0) return true;
        await sleep(Math.min(25, Math.max(1, deadline - Date.now())));
      }
      pump();
      return queue.length === 0 && inFlightBatches === 0;
    })().finally(() => {
      if (activeFlush === run) activeFlush = null;
    });

    activeFlush = run;
    const result = await withTimeout(run, timeoutMs).catch(() => false);
    return result === true;
  }

  async function shutdown(timeoutMs = options.shutdownTimeoutMs): Promise<boolean> {
    if (shutdownStarted) {
      const result = await flush(timeoutMs);
      return result;
    }
    shutdownStarted = true;
    accepting = false;
    clearFlushTimer();
    const result = await flush(timeoutMs);
    clearFlushTimer();
    return result;
  }

  function scheduleProcessing(delayMs: number): void {
    if (shutdownStarted && queue.length === 0 && inFlightBatches === 0) return;
    const targetAt = Date.now() + Math.max(0, delayMs);
    if (flushTimer && flushTimerAt !== null && flushTimerAt <= targetAt) {
      // Existing timer will fire no later than requested.
      return;
    }
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
      flushTimerAt = null;
    }
    const delay = Math.max(0, targetAt - Date.now());
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushTimerAt = null;
      pump();
    }, delay);
    flushTimerAt = targetAt;
    (flushTimer as any).unref?.();
  }

  function clearFlushTimer(): void {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
      flushTimerAt = null;
    }
  }

  function pump(): void {
    if (!options.enabled || !options.apiKey || !options.endpoint) return;

    const now = Date.now();

    while (inFlightBatches < options.maxConcurrentBatchUploads) {
      const batch = dequeueReadyBatch(now);
      if (batch.length === 0) break;

      inFlightBatches += 1;
      void processBatch(batch)
        .catch((error) => {
          // Last-resort guard: treat as upload failure + drop to avoid leaks.
          stats.uploadFailures += 1;
          stats.eventsDropped += batch.length;
          safeWarn(options, "Unexpected batch processing failure", error);
        })
        .finally(() => {
          inFlightBatches = Math.max(0, inFlightBatches - 1);
          if (queue.length > 0 || inFlightBatches > 0) {
            pump();
          } else {
            clearFlushTimer();
          }
        });
    }

    if (queue.length > 0) {
      const nextAt = getNextReadyAt();
      const now2 = Date.now();
      if (nextAt <= now2) {
        scheduleProcessing(0);
      } else {
        scheduleProcessing(Math.min(options.flushIntervalMs, nextAt - now2));
      }
    } else if (inFlightBatches === 0) {
      clearFlushTimer();
    }
  }

  function getNextReadyAt(): number {
    if (queue.length === 0) return Date.now() + options.flushIntervalMs;
    let min = queue[0].nextAttemptAt;
    for (let i = 1; i < queue.length; i++) {
      if (queue[i].nextAttemptAt < min) min = queue[i].nextAttemptAt;
    }
    return min;
  }

  function dequeueReadyBatch(now: number): QueueItem[] {
    if (queue.length === 0) return [];

    const batch: QueueItem[] = [];
    const removeIndices = new Set<number>();
    let bytes = 2; // "[]"

    for (let i = 0; i < queue.length && batch.length < options.maxBatchSize; i++) {
      const item = queue[i];
      // Delayed retries never block ready events elsewhere in the queue.
      if (item.nextAttemptAt > now) continue;

      const itemBytes = safeJsonSize(item.event);
      if (itemBytes === null) {
        removeIndices.add(i);
        stats.eventsDropped += 1;
        safeWarn(options, "Dropping capture event: failed to serialize event payload");
        continue;
      }

      const sep = batch.length > 0 ? 1 : 0;
      const wouldBe = bytes + sep + itemBytes;
      if (batch.length > 0 && wouldBe > MAX_BATCH_BYTES) {
        // Stop this batch; leave later ready items for a subsequent batch.
        break;
      }
      if (batch.length === 0 && itemBytes > MAX_BATCH_BYTES) {
        removeIndices.add(i);
        stats.eventsDropped += 1;
        safeWarn(options, "Dropping capture event: serialized payload exceeds batch size limit");
        continue;
      }

      batch.push(item);
      removeIndices.add(i);
      bytes = wouldBe;
    }

    // Remove selected/dropped entries (back-to-front to keep indices valid).
    const indices = [...removeIndices].sort((a, b) => b - a);
    for (const idx of indices) queue.splice(idx, 1);
    return batch;
  }

  async function processBatch(batch: QueueItem[]): Promise<void> {
    if (batch.length === 0) return;
    stats.batchCount += 1;
    if (!options.enabled || !options.apiKey || !options.endpoint) {
      stats.eventsDropped += batch.length;
      return;
    }

    // Bump attempt counters for this dispatch.
    for (const item of batch) item.attempts += 1;

    const outcome = await uploadBatchEvents(batch.map((b) => b.event));

    if (outcome.ok) {
      stats.eventsDelivered += batch.length;
      return;
    }

    // If per-event results are present, account per event (207 or all-failed 5xx etc.).
    if (Array.isArray(outcome.body?.results)) {
      stats.uploadFailures += 1;
      handlePartialBatchResult(batch, outcome);
      return;
    }

    stats.uploadFailures += 1;

    // 413: payload too large.
    if (outcome.status === 413) {
      await handlePayloadTooLarge(batch);
      return;
    }

    if (!outcome.retryable) {
      stats.eventsDropped += batch.length;
      return;
    }

    requeueForRetry(batch, outcome.retryAfterMs);
  }

  function handlePartialBatchResult(batch: QueueItem[], outcome: UploadOutcome): void {
    const results = Array.isArray(outcome.body?.results) ? outcome.body!.results! : [];

    // Detect duplicate eventId values in results -> ambiguous.
    const idCounts = new Map<string, number>();
    for (const r of results) {
      if (r && typeof r.eventId === "string") {
        idCounts.set(r.eventId, (idCounts.get(r.eventId) || 0) + 1);
      }
    }

    const retryItems: QueueItem[] = [];
    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      // Require exact eventId matching whenever IDs are present.
      let r: BatchItemResult | undefined;
      const exactMatches = results.filter(
        (res) => res && typeof res.eventId === "string" && res.eventId === item.event.eventId,
      );
      if (exactMatches.length === 1) {
        r = exactMatches[0];
      } else if (exactMatches.length === 0) {
        // Only associate by position for a single-item batch when the result has no eventId.
        if (batch.length === 1 && results.length === 1 && !results[0]?.eventId) {
          r = results[0];
        } else {
          r = undefined; // missing/ambiguous
        }
      } else {
        r = undefined; // duplicate exact matches -> ambiguous
      }

      // Also guard against duplicate result ids for this event.
      if (r && typeof r.eventId === "string" && (idCounts.get(r.eventId) || 0) > 1) {
        r = undefined;
      }

      if (!r) {
        // Conservative: retry if attempts remain.
        markRetryOrDrop(item, retryItems, outcome.retryAfterMs, true);
        continue;
      }

      // Duplicate/idempotent success counts as delivered.
      if (!r.error) {
        stats.eventsDelivered += 1;
        continue;
      }

      const retryable =
        typeof r.retryable === "boolean"
          ? r.retryable
          : outcome.retryable || isRetryableStatus(outcome.status ?? 0);

      if (retryable) {
        markRetryOrDrop(item, retryItems, outcome.retryAfterMs, false);
      } else {
        stats.eventsDropped += 1;
      }
    }

    if (retryItems.length > 0) enqueueRetries(retryItems);
  }

  async function handlePayloadTooLarge(batch: QueueItem[]): Promise<void> {
    if (batch.length <= 1) {
      // Cannot split a single event further.
      stats.eventsDropped += batch.length;
      safeWarn(options, "Dropping capture event: ingest rejected payload as too large (413)");
      return;
    }
    // Split batch and retry immediately within the same in-flight slot to avoid recombination.
    for (const item of batch) item.attempts = Math.max(0, item.attempts - 1);
    const mid = Math.ceil(batch.length / 2);
    const left = batch.slice(0, mid);
    const right = batch.slice(mid);
    await processBatch(left);
    await processBatch(right);
  }

  function markRetryOrDrop(
    item: QueueItem,
    retryItems: QueueItem[],
    retryAfterMs: number | undefined,
    ambiguous: boolean,
  ): void {
    if (item.attempts >= options.maxRetryAttempts) {
      stats.eventsDropped += 1;
      return;
    }
    stats.retryAttempts += 1;
    const delay = computeRetryDelayMs(item.attempts, options, retryAfterMs);
    retryItems.push({ ...item, nextAttemptAt: Date.now() + delay });
    if (ambiguous) {
      // already counted as upload failure at batch level; nothing extra
    }
  }

  function requeueForRetry(batch: QueueItem[], retryAfterMs?: number): void {
    const retryItems: QueueItem[] = [];
    for (const item of batch) {
      if (item.attempts >= options.maxRetryAttempts) {
        stats.eventsDropped += 1;
        continue;
      }
      stats.retryAttempts += 1;
      const delay = computeRetryDelayMs(item.attempts, options, retryAfterMs);
      retryItems.push({ ...item, nextAttemptAt: Date.now() + delay });
    }
    if (retryItems.length > 0) enqueueRetries(retryItems);
  }

  function enqueueRetries(items: QueueItem[]): void {
    if (items.length === 0) return;
    // Append retries to the back so delayed retries never block ready events at the front.
    // Retry deadlines are preserved via nextAttemptAt and getNextReadyAt().
    queue.push(...items);
    if (queue.length > options.maxQueueSize) {
      const overflow = queue.length - options.maxQueueSize;
      queue.splice(queue.length - overflow, overflow);
      stats.eventsDropped += overflow;
    }
    const nextAt = Math.min(...items.map((r) => r.nextAttemptAt));
    scheduleProcessing(Math.max(0, nextAt - Date.now()));
  }

  async function uploadBatchEvents(events: Array<CaptureEvent & { eventId: string }>): Promise<UploadOutcome> {
    if (events.length === 1 && batchEndpointUnsupported) {
      return uploadSingle(events[0]);
    }

    if (!batchEndpointUnsupported) {
      const batchResult = await postJson(batchUrl, { events }, true);
      if (batchResult.status === 404) {
        batchEndpointUnsupported = true;
        if (events.length === 1) return uploadSingle(events[0]);
        // Fallback: send individually in order.
        return uploadSequentialFallback(events);
      }
      return batchResult;
    }

    return uploadSequentialFallback(events);
  }

  async function uploadSequentialFallback(events: Array<CaptureEvent & { eventId: string }>): Promise<UploadOutcome> {
    // Sequential fallback preserves order; aggregate conservatively.
    for (let i = 0; i < events.length; i++) {
      const r = await uploadSingle(events[i]);
      if (!r.ok) {
        // If one fails mid-way, we cannot safely express partial state here; caller handles batch outcome.
        // Mark as failed at this point; for simplicity return retryable/failure for remaining handling.
        // Better: synthesize 207-like? but caller expects UploadOutcome. We'll return r and let caller
        // requeue whole batch only if appropriate - however earlier events may be delivered.
        // To avoid duplicates/loss, treat as partial by constructing a synthetic body when possible.
        const results: BatchItemResult[] = events.map((e, idx) => {
          if (idx < i) return { eventId: e.eventId, duplicate: false };
          if (idx === i) return { eventId: e.eventId, duplicate: false, error: "upload failed", retryable: r.retryable };
          return { eventId: e.eventId, duplicate: false, error: "not attempted", retryable: r.retryable };
        });
        return { ok: false, retryable: r.retryable, status: r.status ?? 207, retryAfterMs: r.retryAfterMs, ambiguous: r.ambiguous, body: { results } };
      }
    }
    return { ok: true, retryable: false };
  }

  async function uploadSingle(event: CaptureEvent & { eventId: string }): Promise<UploadOutcome> {
    return postJson(ingestUrl, event, false);
  }

  async function postJson(url: string, payload: unknown, expectBatchBody: boolean): Promise<UploadOutcome> {
    let body: string;
    try {
      body = JSON.stringify(payload);
    } catch (error) {
      safeWarn(options, "Failed to serialize delivery payload", error);
      return { ok: false, retryable: false };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.uploadTimeoutMs);
    (timeout as any).unref?.();

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-devreplay-api-key": options.apiKey,
        },
        body,
        signal: controller.signal,
      });

      const responseBody = await readResponseBody(response, expectBatchBody || response.status === 207);

      if (response.status === 207) {
        return { ok: false, retryable: false, status: 207, body: responseBody };
      }

      if (response.ok) {
        return { ok: true, retryable: false, status: response.status, body: responseBody };
      }

      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      const retryable = isRetryableStatus(response.status);
      if (!retryable) {
        if (response.status !== 404 && response.status !== 413) {
          safeWarn(options, `Ingest responded with non-retryable status ${response.status}`);
        }
      } else {
        safeWarn(options, `Ingest responded with retryable status ${response.status}`);
      }
      return { ok: false, retryable, status: response.status, retryAfterMs, body: responseBody };
    } catch (error) {
      if (isAbortError(error)) {
        safeWarn(options, "Ingest upload timed out");
        return { ok: false, retryable: true, ambiguous: true };
      }
      safeWarn(options, "Ingest upload failed", error);
      return { ok: false, retryable: true, ambiguous: true };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { enqueue, flush, shutdown, getStats };
}

function createEventId(): string {
  try {
    return `evt_${randomUUID()}`;
  } catch {
    return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function safeJsonSize(value: unknown): number | null {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return null;
  }
}

function isRetryableStatus(status: number): boolean {
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  return false;
}

function parseRetryAfterMs(value: string | null): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.floor(seconds * 1000);
  }
  const dateMs = Date.parse(trimmed);
  if (!Number.isNaN(dateMs)) {
    return Math.max(0, dateMs - Date.now());
  }
  return undefined;
}

function computeRetryDelayMs(
  completedAttempts: number,
  options: ResolvedDevReplayOptions,
  retryAfterMs?: number,
): number {
  const exp = Math.min(
    options.retryMaxDelayMs,
    options.retryBaseDelayMs * Math.pow(2, Math.max(0, completedAttempts - 1)),
  );
  const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(exp * 0.25) + 1));
  const backoff = Math.min(options.retryMaxDelayMs, exp + jitter);
  if (typeof retryAfterMs === "number" && Number.isFinite(retryAfterMs)) {
    return Math.min(options.retryMaxDelayMs, Math.max(backoff, Math.floor(retryAfterMs)));
  }
  return backoff;
}

async function readResponseBody(response: Response, parseJson: boolean): Promise<BatchResponseBody | null> {
  try {
    if (!parseJson) {
      await discardResponseBody(response);
      return null;
    }
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text) as BatchResponseBody;
    } catch {
      return null;
    }
  } catch {
    await discardResponseBody(response);
    return null;
  }
}

async function discardResponseBody(response: Response): Promise<void> {
  try {
    if (response.body && typeof (response.body as any).cancel === "function") {
      await (response.body as any).cancel();
      return;
    }
  } catch {
    // fall through
  }
  try {
    await response.arrayBuffer();
  } catch {
    // ignore
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
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
    // never throw from logging path
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    (t as any).unref?.();
  });
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Operation timed out")), Math.max(0, timeoutMs));
        (timer as any).unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
