import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

export async function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  try {
   const requestLog =  await prisma.requestLog.create({
      data: {
        method: req.method,
        path: req.path,
        body: req.body,
      },
      
    });
   

    res.on("finish", async() => {
      const durationMs = Date.now() - startTime;
      console.log(`${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
      await prisma.requestLog.update({
        where: {
          id: requestLog.id
        },
        data: {
          
          statusCode: res.statusCode,
          durationMs: durationMs,
        }
      })
    });
    console.log(`Recorded ${req.method} ${req.path}`);
    next();
  } catch (error) {
    console.error("Recording failed:", error);
    next();
  }
}
