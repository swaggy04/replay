import type { Request, Response } from "express";

export async function replayController(req: Request, res: Response) {
  const requestId = req.params.id;

  console.log("Replay ID:", requestId);

  res.json({
    requestId,
  });
}