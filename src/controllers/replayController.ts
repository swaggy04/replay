
import type { Request, Response } from "express";

import {
  replayService,
} from "../services/replayService.js";

import prisma from "../lib/prisma.js";

export async function replayController(req: Request, res: Response) {
  try {
    const ownerId = res.locals.userId as string;
    const requestId = req.params.id;

    if (typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid request ID",
      });
    }

    // This lookup also checks project ownership.
    const replay = await replayService(requestId, ownerId);

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

    const startTime = Date.now();

    const response = await fetch(replay.url, {
      method: replay.method,
      headers,
      body: replay.body,
    });

    const contentType = response.headers.get("content-type");

    let responseBody: unknown;

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
        responseBody:
          responseBody === undefined ? undefined : responseBody as any,
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
