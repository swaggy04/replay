import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import prisma from "../lib/prisma.js";

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized. Please sign in.",
      });
    }

    // Find the local user or create one on their first API request.
    const user = await prisma.user.upsert({
      where: {
        clerkUserId: userId,
      },
      update: {},
      create: {
        clerkUserId: userId,
      },
    });

    // Make the local database user ID available to controllers.
    res.locals.userId = user.id;

    next();
  } catch (error) {
    console.error("Authentication middleware failed:", error);

    return res.status(500).json({
      message: "Failed to authenticate user",
    });
  }
}
