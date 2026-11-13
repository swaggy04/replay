
import type { Request, Response } from "express";
import { captureRequest, captureRequests } from "../services/captureService.js";
import type { CaptureRequestInput } from "../types/capture.js";

const allowedMethods = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);

const sensitiveHeaders = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "x-api-key",
  "x-devreplay-api-key",
]);

type ValidationResult =
  | { ok: true; value: Omit<CaptureRequestInput, "projectId"> }
  | { ok: false; message: string };

function redactHeaders(
  headers: unknown,
): CaptureRequestInput["headers"] {
  if (!headers || typeof headers !== "object" || Array.isArray(headers)) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      sensitiveHeaders.has(name.toLowerCase()) ? "[REDACTED]" : value,
    ]),
  ) as CaptureRequestInput["headers"];
}

function parseCaptureEvent(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Invalid request payload" };
  }

  const {
    eventId,
    method,
    path,
    body: requestBody,
    headers,
    query,
    statusCode,
    responseBody,
    durationMs,
  } = body as Record<string, unknown>;

  if (typeof method !== "string" || typeof path !== "string") {
    return { ok: false, message: "method and path are required" };
  }

  const normalizedMethod = method.toUpperCase();
  if (!allowedMethods.has(normalizedMethod)) {
    return { ok: false, message: "Unsupported HTTP method" };
  }

  if (!path.startsWith("/") || path.startsWith("//") || path.length > 2048) {
    return { ok: false, message: "Invalid request path" };
  }

  if (eventId !== undefined) {
    if (typeof eventId !== "string" || eventId.trim().length === 0 || eventId.length > 128) {
      return { ok: false, message: "Invalid eventId" };
    }
  }

  if (
    statusCode !== undefined &&
    (!Number.isInteger(statusCode) || (statusCode as number) < 100 || (statusCode as number) > 599)
  ) {
    return { ok: false, message: "Invalid status code" };
  }

  if (
    durationMs !== undefined &&
    (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0)
  ) {
    return { ok: false, message: "Invalid duration" };
  }

  const normalizedDurationMs =
    typeof durationMs === "number" ? Math.round(durationMs) : undefined;

  return {
    ok: true,
    value: {
      eventId: typeof eventId === "string" ? eventId : undefined,
      method: normalizedMethod,
      path,
      body: requestBody as any,
      headers: redactHeaders(headers),
      query: query as any,
      statusCode: statusCode as number | undefined,
      responseBody: responseBody as any,
      durationMs: normalizedDurationMs,
    },
  };
}

export async function captureController(req: Request, res: Response) {
  try {
    // Set by requireApiKey after successful API-key verification.
    const projectId = res.locals.projectId as string | undefined;

    if (!projectId) {
      return res.status(401).json({
        message: "Invalid API key",
      });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return res.status(400).json({
        message: "Invalid request payload",
      });
    }

    const parsed = parseCaptureEvent(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ message: parsed.message });
    }

    const requestLog = await captureRequest({
      projectId,
      ...parsed.value,
    });

    // Preserve existing single-event response contract.
    return res.status(201).json({
      id: requestLog.id,
      message: "Request captured successfully",
    });
  } catch (error) {
    console.error("Failed to capture request:", error);

    return res.status(500).json({
      message: "Failed to capture request",
    });
  }
}

export async function batchCaptureController(req: Request, res: Response) {
  try {
    const projectId = res.locals.projectId as string | undefined;

    if (!projectId) {
      return res.status(401).json({
        message: "Invalid API key",
      });
    }

    const payload = req.body;
    let eventsPayload: unknown[] | null = null;

    if (Array.isArray(payload)) {
      eventsPayload = payload;
    } else if (payload && typeof payload === "object" && Array.isArray((payload as any).events)) {
      eventsPayload = (payload as any).events as unknown[];
    }

    if (!eventsPayload) {
      return res.status(400).json({
        message: "Invalid batch payload",
      });
    }

    if (eventsPayload.length === 0) {
      return res.status(400).json({
        message: "Batch must contain at least one event",
      });
    }

    if (eventsPayload.length > 100) {
      return res.status(400).json({
        message: "Batch size exceeds limit",
      });
    }

    const inputs: CaptureRequestInput[] = [];
    for (let i = 0; i < eventsPayload.length; i++) {
      const parsed = parseCaptureEvent(eventsPayload[i]);
      if (!parsed.ok) {
        // Permanent/malformed payload in batch: do not partially ingest ambiguous batch.
        return res.status(400).json({
          message: "Invalid batch payload",
          error: parsed.message,
          index: i,
        });
      }
      inputs.push({ projectId, ...parsed.value });
    }

    const result = await captureRequests(inputs);

    if (result.failed > 0 && result.accepted === 0 && result.duplicates === 0) {
      return res.status(500).json({
        message: "Failed to capture batch",
        ...result,
      });
    }

    const status = result.failed > 0 ? 207 : 201;
    return res.status(status).json({
      message: result.failed > 0 ? "Batch captured with partial failures" : "Batch captured successfully",
      ...result,
    });
  } catch (error) {
    console.error("Failed to capture batch:", error);

    return res.status(500).json({
      message: "Failed to capture batch",
    });
  }
}
