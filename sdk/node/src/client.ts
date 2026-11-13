import type { CaptureEvent, ResolvedDevReplayOptions } from "./types.js";

export function createClient(options: ResolvedDevReplayOptions) {
  const endpoint = options.endpoint.replace(/\/+$/, "");
  const ingestUrl = `${endpoint}/ingest`;

  function send(event: CaptureEvent): void {
    if (!options.enabled) return;
    if (!options.apiKey || !options.endpoint) return;

    // Fire-and-forget: never block response path and never throw.
    void upload(event).catch((error) => {
      safeWarn(options, "Failed to upload capture event", error);
    });
  }

  async function upload(event: CaptureEvent): Promise<void> {
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
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      // Drain small response bodies to avoid socket issues in some runtimes.
      if (!response.ok) {
        try {
          await response.text();
        } catch {
          // ignore
        }
        safeWarn(options, `Ingest responded with status ${response.status}`);
      } else {
        try {
          await response.arrayBuffer();
        } catch {
          // ignore
        }
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
