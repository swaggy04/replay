
import type { Request, Response } from "express";
import { captureRequest } from "../services/captureService.js";
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

function redactHeaders(
  headers: unknown,
): CaptureRequestInput["headers"] {
  if (
    !headers ||
    typeof headers !== "object" ||
    Array.isArray(headers)
  ) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [
      name,
      sensitiveHeaders.has(name.toLowerCase())
        ? "[REDACTED]"
        : value,
    ]),
  ) as CaptureRequestInput["headers"];
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

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        message: "Invalid request payload",
      });
    }

    const {
      method,
      path,
      body,
      headers,
      query,
      statusCode,
      responseBody,
      durationMs,
    } = req.body;

    if (typeof method !== "string" || typeof path !== "string") {
      return res.status(400).json({
        message: "method and path are required",
      });
    }

    const normalizedMethod = method.toUpperCase();

    if (!allowedMethods.has(normalizedMethod)) {
      return res.status(400).json({
        message: "Unsupported HTTP method",
      });
    }

    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.length > 2048
    ) {
      return res.status(400).json({
        message: "Invalid request path",
      });
    }

    if (
      statusCode !== undefined &&
      (!Number.isInteger(statusCode) ||
        statusCode < 100 ||
        statusCode > 599)
    ) {
      return res.status(400).json({
        message: "Invalid status code",
      });
    }

    if (
      durationMs !== undefined &&
      (typeof durationMs !== "number" ||
        !Number.isFinite(durationMs) ||
        durationMs < 0)
    ) {
      return res.status(400).json({
        message: "Invalid duration",
      });
    }

    const requestLog = await captureRequest({
      projectId,
      method: normalizedMethod,
      path,
      body,
      headers: redactHeaders(headers),
      query,
      statusCode,
      responseBody,
      durationMs,
    });

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
