import type { Request, Response } from "express";
import { requestIdService, requestService } from "../services/requestsService.js";

export async function requestController(req: Request, res: Response) {
  const page = Number(req.query.page ?? 1);
  const limit = Number(req.query.limit ?? 5);
  const allRequests = await requestService(page,limit);
  console.log(page, limit);
  return res.json(allRequests);
}

export async function requestIdController(req: Request, res: Response) {
  const requestId = req.params.id;

  if (typeof requestId !== "string") {
    return res.status(400).json({
      message: "Invalid request ID",
    });
  }

  const ReqId = await requestIdService(requestId);
  if (!ReqId) {
    return res.status(404).json({
      message: "Request not found",
    });
  }
  return res.json(ReqId);
}
