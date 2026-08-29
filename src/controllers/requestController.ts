import type { Request, Response } from "express";
import { requestIdService, requestService } from "../services/requestsService.js";

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

  const request  = await requestIdService(requestId);
  if (!request ) {
    return res.status(404).json({
      message: "Request not found",
    });
  }
  return res.json(request );
}
