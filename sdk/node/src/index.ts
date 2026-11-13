import type { RequestHandler } from "express";
import { createDevReplayMiddleware, resolveOptions } from "./middleware.js";
import type { DevReplayOptions } from "./types.js";

export class DevReplay {
  private readonly options: ReturnType<typeof resolveOptions>;

  constructor(options: DevReplayOptions) {
    this.options = resolveOptions(options);
  }

  middleware(): RequestHandler {
    // Intended usage: app.use(express.json()); app.use(devreplay.middleware()); app.use(routes)
    // Middleware should come after body parsers and before application routes.
    return createDevReplayMiddleware(this.options);
  }
}

export type { DevReplayOptions, CaptureEvent } from "./types.js";
export {
  createDevReplayMiddleware,
  resolveOptions,
  shouldCaptureRequest,
  redactHeaders,
  redactAndClone,
  sanitizeRequestBody,
  sanitizeResponseBody,
} from "./middleware.js";
