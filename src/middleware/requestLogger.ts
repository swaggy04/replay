import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

export async function requestLogger(req: Request, res: Response, next: NextFunction) {
  try {
    await prisma.requestLog.create({
      data: {
        method: req.method,
        path: req.path,
        body:req.body
      },
    });
    const startTime = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - startTime;
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
    });
    console.log(`Recorded ${req.method} ${req.path}`);
    next();
  } catch (error) {
    console.error("Recording failed:", error);
    next();
  }
}
