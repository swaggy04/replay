
import type { Request, Response } from "express";

import {
  compareReplayService,
  requestIdService,
  requestService,
} from "../services/requestsService.js";

import { replayHistoryService } from "../services/replayService.js";

export async function requestController(req: Request, res: Response) {
  try {
    const ownerId = res.locals.userId as string;

    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);

    if (
      !Number.isInteger(page) ||
      !Number.isInteger(limit) ||
      page < 1 ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        message: "Invalid pagination parameters",
      });
    }

    const projectId =
      typeof req.query.projectId === "string"
        ? req.query.projectId
        : undefined;

    const result = await requestService(
      page,
      limit,
      ownerId,
      projectId
    );

    return res.status(200).json({
      data: result.requests,
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: result.totalPages,
    });
  } catch (error) {
    console.error("Failed to fetch requests:", error);

    return res.status(500).json({
      message: "Failed to fetch requests",
    });
  }
}

export async function requestIdController(req: Request, res: Response) {
  try {
    const ownerId = res.locals.userId as string;
    const requestId = req.params.id;

    if (typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid request ID",
      });
    }

    const request = await requestIdService(requestId, ownerId);

    if (!request) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    return res.status(200).json(request);
  } catch (error) {
    console.error("Failed to fetch request:", error);

    return res.status(500).json({
      message: "Failed to fetch request",
    });
  }
}

export async function replayHistoryController(
  req: Request,
  res: Response
) {
  try {
    const ownerId = res.locals.userId as string;

    // Both history routes use :id in app.ts.
    const requestId = req.params.id;

    if (typeof requestId !== "string") {
      return res.status(400).json({
        message: "Invalid request ID",
      });
    }

    const replays = await replayHistoryService(
      requestId,
      ownerId
    );

    if (replays === null) {
      return res.status(404).json({
        message: "Request not found",
      });
    }

    return res.status(200).json(replays);
  } catch (error) {
    console.error("Failed to fetch replay history:", error);

    return res.status(500).json({
      message: "Failed to fetch replay history",
    });
  }
}

export async function compareReplayController(
  req: Request,
  res: Response
) {
  try {
    const ownerId = res.locals.userId as string;

    const requestId = req.params.id;
    const replayId = req.params.replayId;

    if (
      typeof requestId !== "string" ||
      typeof replayId !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid request ID or replay ID",
      });
    }

    const result = await compareReplayService(
      requestId,
      replayId,
      ownerId
    );

    if (!result.original || !result.replay) {
      return res.status(404).json({
        message: "Request or replay not found",
      });
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error("Failed to compare replay:", error);

    return res.status(500).json({
      message: "Failed to compare replay",
    });
  }
}
