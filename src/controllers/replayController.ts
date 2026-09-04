import type { Request, Response } from "express";

import { replayHistoryService, replayService } from "../services/replayService.js";

import prisma from "../lib/prisma.js";

export async function replayController(req: Request, res: Response) {
  const requestId = req.params.id;

  if (typeof requestId !== "string") {
    return res.status(400).json({
      message: "Invalid request ID",
    });
  }

  const replay = await replayService(requestId);

  if (!replay) {
    return res.status(404).json({
      message: "Request not found",
    });
  }

  const headers = {
    ...((replay.headers ?? {}) as Record<string, string>),
  };

  delete headers.host;
  delete headers["content-length"];
  delete headers.connection;
  delete headers["accept-encoding"];

  try {
    const startTime = Date.now();

    const response = await fetch(replay.url, {
      method: replay.method,
      headers,
      body: replay.body,
    });

    const contentType = response.headers.get("content-type");

    let responseBody;

    if (contentType?.includes("application/json")) {
      responseBody = await response.json();
    } else {
      responseBody = await response.text();
    }

    const durationMs = Date.now() - startTime;

    const replayExecution = await prisma.replayExecution.create({
      data: {
        requestLogId: requestId,
        statusCode: response.status,
        responseBody,
        durationMs,
      },
    });

    return res.status(response.status).json({
      status: response.status,
      body: responseBody,
      replay: replayExecution,
    });
  } catch (error) {
    console.error("Replay failed:", error);

    return res.status(500).json({
      message: "Replay failed",
    });
  }
}
export async function replayHistoryController(req: Request, res: Response) {
  try {
    const { requestId } = req.params;
    if (typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid request ID",
      });
    }

    const result = await replayHistoryService(requestId);

    return res.json(result);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to fetch replay history",
    });
  }
}
