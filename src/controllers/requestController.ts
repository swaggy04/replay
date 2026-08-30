import type { Request, Response } from "express";
import { compareReplayService, requestIdService, requestService } from "../services/requestsService.js";
import { replayHistoryService } from "../services/replayService.js";

export async function requestController(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 5);

  if (!Number.isInteger(page) || !Number.isInteger(limit) || page < 1 || limit < 1 || limit > 100) {
    return res.status(400).json({
      message: "Invalid pagination parameters",
    });
  }

  const { requests, total } = await requestService(page, limit);

  const totalPages = Math.ceil(total / limit);

  return res.json({
    data: requests,
    page,
    limit,
    total,
    totalPages,
  });
}

export async function requestIdController(req: Request, res: Response) {
  const requestId = req.params.id;

  if (typeof requestId !== "string") {
    return res.status(400).json({
      message: "Invalid request ID",
    });
  }

  const request = await requestIdService(requestId);
  if (!request) {
    return res.status(404).json({
      message: "Request not found",
    });
  }
  return res.json(request);
}

export async function replayHistoryController(req: Request, res: Response) {
  const requestId = req.params.id;

  if (typeof requestId !== "string") {
    return res.status(400).json({
      message: "Invalid request ID",
    });
  }
  const replays = await replayHistoryService(requestId);
  return res.json(replays);
}

export async function compareReplayController(req: Request, res: Response) {
  const requestId = req.params.id;
  const replayId = req.params.replayId;
  if (typeof requestId !== "string" || typeof replayId !== "string") {
    return res.status(400).json({
      message: "Invalid request ID or replay ID",
    });
  }
  const result = await compareReplayService(requestId, replayId);
  if (!result.original || !result.replay) {
    return res.status(404).json({
      message: "Request or replay not found",
    });
  }
  return res.json(result);
}
