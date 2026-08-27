import type { Request, Response } from "express";
import { requestService } from "../services/requestsService.js";

export async function requestController(req: Request, res: Response) {
  const allRequests = await requestService();

  return res.json(allRequests);
}
