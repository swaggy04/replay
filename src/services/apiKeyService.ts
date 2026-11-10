
import { createHash, randomBytes } from "node:crypto";

import prisma from "../lib/prisma.js";

function hashApiKey(key: string): string {
    return createHash("sha256")
        .update(key)
        .digest("hex");
}

export async function createApiKey(
    projectId: string,
    ownerId: string,
) {
    // Verify project ownership.
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            ownerId,
        },
        select: {
            id: true,
        },
    });

    if (!project) {
        return null;
    }

    // Generate a cryptographically secure 256-bit secret.
    const rawKey = `dr_live_${randomBytes(32).toString("hex")}`;

    // Only the hash is stored in PostgreSQL.
    const hashedKey = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);

    const apiKey = await prisma.apiKey.create({
        data: {
            key: hashedKey,
            keyPrefix,
            projectId,
        },
        select: {
            id: true,
            keyPrefix: true,
            createdAt: true,
            projectId: true,
        },
    });

    // Return the raw secret only during creation.
    return {
        ...apiKey,
        rawKey,
    };
}

export async function getProjectApiKeys(
    projectId: string,
    ownerId: string,
) {
    const project = await prisma.project.findFirst({
        where: {
            id: projectId,
            ownerId,
        },
        select: {
            id: true,
        },
    });

    if (!project) {
        return null;
    }

    return prisma.apiKey.findMany({
        where: {
            projectId,
            revokedAt: null,
        },
        select: {
            id: true,
            keyPrefix: true,
            createdAt: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });
}

export async function revokeApiKey(
    projectId: string,
    keyId: string,
    ownerId: string,
) {
    const result = await prisma.apiKey.updateMany({
        where: {
            id: keyId,
            projectId,
            revokedAt: null,
            project: {
                is: {
                    ownerId,
                },
            },
        },
        data: {
            revokedAt: new Date(),
        },
    });

    return result.count > 0;
}
