import type { Request, Response } from "express";
import { requestIdService, requestService } from "../services/requestsService.js";

export async function requestController(req: Request, res: Response) {
  const allRequests = await requestService();

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

  return res.json(ReqId);
}
