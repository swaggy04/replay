import type { CaptureEvent, ResolvedDevReplayOptions } from "./types.js";

export function createClient(options: ResolvedDevReplayOptions) {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const ingestUrl = `${endpoint}/ingest`;
  let inFlight = 0;

  function send(event: CaptureEvent): void {
    if (!options.enabled) return;
    if (!options.apiKey || !options.endpoint) return;

    if (inFlight >= options.maxConcurrentUploads) {
      safeWarn(options, "Dropping capture event: max concurrent uploads reached");
      return;
    }

    inFlight += 1;
    // Fire-and-forget: never block response path and never throw.
    void upload(event)
      .catch((error) => {
        safeWarn(options, "Failed to upload capture event", error);
      })
      .finally(() => {
        inFlight = Math.max(0, inFlight - 1);
      });
  }

  async function upload(event: CaptureEvent): Promise<void> {
    let body: string;
    try {
      body = JSON.stringify(event);
    } catch (error) {
      safeWarn(options, "Failed to serialize capture event", error);
      return;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.uploadTimeoutMs);
    timeout.unref?.();

    try {
      const response = await fetch(ingestUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-devreplay-api-key": options.apiKey,
        },
        body,
        signal: controller.signal,
      });

      // Avoid buffering potentially large ingest response bodies.
      await discardResponseBody(response);

      if (!response.ok) {
        safeWarn(options, `Ingest responded with status ${response.status}`);
      }
    } catch (error) {
      if (isAbortError(error)) {
        safeWarn(options, "Ingest upload timed out");
        return;
      }
      safeWarn(options, "Ingest upload failed", error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return { send };
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
    // Fallback: consume without retaining application-level buffers where possible.
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
