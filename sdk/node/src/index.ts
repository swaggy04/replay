import type { RequestHandler } from "express";
import { createDevReplayMiddleware, createDevReplayRuntime, resolveOptions } from "./middleware.js";
import type { DeliveryStats, DevReplayOptions } from "./types.js";

export class DevReplay {
  private readonly runtime: ReturnType<typeof createDevReplayRuntime>;

  constructor(options: DevReplayOptions) {
    this.runtime = createDevReplayRuntime(options);
  }

  middleware(): RequestHandler {
    // Intended usage: app.use(express.json()); app.use(devreplay.middleware()); app.use(routes)
    // Middleware must come after body parsers and before application routes.
    return this.runtime.middleware;
  }

  flush(timeoutMs?: number): Promise<boolean> {
    return this.runtime.flush(timeoutMs);
  }

  shutdown(timeoutMs?: number): Promise<boolean> {
    return this.runtime.shutdown(timeoutMs);
  }

  getStats(): DeliveryStats {
    return this.runtime.getStats();
  }
}

export type { CaptureEvent, DeliveryStats, DevReplayOptions } from "./types.js";
export {
  applyPayloadLimit,
  applyBodyLimit,
  createDevReplayMiddleware,
  createDevReplayRuntime,
  redactAndClone,
  redactHeaders,
  resolveOptions,
  sanitizeQuery,
  sanitizeRequestBody,
  sanitizeResponseBody,
  shouldCaptureRequest,
} from "./middleware.js";
