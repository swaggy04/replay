import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

export async function requestLogger(req: Request, _res: Response, next: NextFunction) {
  try {
    await prisma.requestLog.create({
      data: {
        method: req.method,
        path: req.path,
      },
    });
    console.log(`Recorded ${req.method} ${req.path}`);
    next();
  } catch (error) {
    console.error("Recording failed:", error);
    next();
  }
}
