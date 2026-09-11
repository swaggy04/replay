import type { Request, Response } from "express";
import { captureRequest } from "../services/captureService.js";

export async function captureController(req: Request, res: Response) {
  try {
    const { projectId, method, path, body, headers, query, statusCode, responseBody, durationMs } = req.body;

    if (!projectId || !method || !path) {
      return res.status(400).json({
        message: "projectId, method and path are required",
      });
    }

    const requestLog = await captureRequest({
      projectId,
      method,
      path,
      body,
      headers,
      query,
      statusCode,
      responseBody,
      durationMs,
    });

    return res.status(201).json(requestLog);
  } catch (error) {
    console.error("Failed to capture request:", error);

    return res.status(500).json({
      message: "Failed to capture request",
      error: error instanceof Error ? error.message : error,
    });
  }
}
