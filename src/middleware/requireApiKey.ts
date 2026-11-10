import type { Request, Response, NextFunction } from "express";
import { createHash } from "node:crypto";
import prisma from "../lib/prisma.js";

function hashApiKey(key: string): string {
    return createHash("sha256").update(key).digest("hex");
}

export async function requireApiKey(
    req: Request,
    res: Response,
    next: NextFunction,
) {
    try {
        const apiKey = req.header("x-devreplay-api-key");

        if (!apiKey || !apiKey.startsWith("dr_live_")) {
            return res.status(401).json({ message: "Invalid API key" });
        }

        const hashedKey = hashApiKey(apiKey);

        const storedApiKey = await prisma.apiKey.findFirst({
            where: {
                key: hashedKey,
                revokedAt: null,
            },
            select: {
                projectId: true,
            },
        });

        if (!storedApiKey) {
            return res.status(401).json({ message: "Invalid API key" });
        }

        // The project ID is trusted only because it came from the verified key.
        res.locals.projectId = storedApiKey.projectId;

        return next();
    } catch (error) {
        console.error("API key authentication failed:", error);
        return res.status(500).json({ message: "API key authentication failed" });
    }
}