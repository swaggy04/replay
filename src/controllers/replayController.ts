import type { Request, Response } from "express";

import { executeReplay } from "../services/replayService.js";

export async function replayController(req: Request, res: Response) {
  try {
    const ownerId = res.locals.userId as string;
    const requestId = req.params.id;

    if (typeof requestId !== "string") {
      return res.status(400).json({ message: "Invalid request ID" });
    }

    const result = await executeReplay(requestId, ownerId);

    if (!result) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (result.infraError) {
      return res.status(502).json({
        message: "Replay failed",
        error: result.infraError,
        replay: result.replay,
      });
    }

    return res.status(result.status >= 200 && result.status < 600 ? result.status : 200).json({
      status: result.status,
      body: result.body,
      targetError: result.targetError,
      replay: result.replay,
    });
  } catch (error) {
    console.error("Replay failed:", error);
    const message = error instanceof Error ? error.message : "Replay failed";
    // Missing target configuration -> 400
    if (message.toLowerCase().includes("not configured")) {
      return res.status(400).json({ message });
    }
    return res.status(500).json({ message });
  }
}
