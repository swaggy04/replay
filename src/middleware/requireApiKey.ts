
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

        // dr_live_ + 64 hexadecimal characters.
        if (!apiKey || !/^dr_live_[a-f0-9]{64}$/.test(apiKey)) {
            return res.status(401).json({
                message: "Invalid API key",
            });
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
            return res.status(401).json({
                message: "Invalid or revoked API key",
            });
        }

        // Only the verified database record determines project ownership.
        res.locals.projectId = storedApiKey.projectId;

        return next();
    } catch (error) {
        console.error("API key authentication failed:", error);

        return res.status(500).json({
            message: "API key authentication failed",
        });
    }
}
