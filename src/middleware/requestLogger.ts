import type { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma.js";

export async function requestLogger(req: Request, res: Response, next: NextFunction) {
  const startTime = Date.now();
  let responseBody: any;

  try {
    const requestLog = await prisma.requestLog.create({
      data: {
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query,
        headers: req.headers,
      },
    });

    const originalJson = res.json.bind(res);

    res.json = function (body) {
      responseBody = body;

      return originalJson(body);
    };

    res.on("finish", async () => {
      try {
        const durationMs = Date.now() - startTime;

        console.log(`${req.method} ${req.path} → ${res.statusCode} (${durationMs}ms)`);

        await prisma.requestLog.update({
          where: {
            id: requestLog.id,
          },
          data: {
            statusCode: res.statusCode,
            durationMs,
            responseBody,
          },
        });
      } catch (error) {
        console.error("Failed to update request log:", error);
      }
    });

    console.log(`Recorded ${req.method} ${req.path}`);

    next();
  } catch (error) {
    console.error("Recording failed:", error);
    next();
  }
}
