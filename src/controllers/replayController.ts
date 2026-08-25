import type { Request, Response } from "express";
import { replayService } from "../services/replayService.js";

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

  const response = await fetch(replay.url, {
    method: replay.method,
    headers,
    body: replay.body,
  });

  const responseBody = await response.json();

  return res.status(response.status).json({
    status: response.status,
    body: responseBody,
  });
}
