
import { createHash, randomBytes } from "node:crypto";

import prisma from "../lib/prisma.js";
import { decryptApiKey, encryptApiKey } from "../utils/apiKeyEncryption.js";

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

    // Hash is stored for authentication lookup; encrypted value is stored for
    // owner-authorized reveal. Plaintext is never persisted.
    const hashedKey = hashApiKey(rawKey);
    const keyPrefix = rawKey.slice(0, 16);
    const encrypted = encryptApiKey(rawKey);

    const apiKey = await prisma.apiKey.create({
        data: {
            key: hashedKey,
            keyPrefix,
            projectId,
            encryptedKey: encrypted.encryptedKey,
            encryptionIv: encrypted.encryptionIv,
            encryptionTag: encrypted.encryptionTag,
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

    const keys = await prisma.apiKey.findMany({
        where: {
            projectId,
            revokedAt: null,
        },
        select: {
            id: true,
            keyPrefix: true,
            createdAt: true,
            encryptedKey: true,
        },
        orderBy: {
            createdAt: "desc",
        },
    });

    return keys.map(({ encryptedKey, ...rest }) => ({
        ...rest,
        canReveal: encryptedKey !== null,
    }));
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

export type RevealApiKeyResult =
    | { ok: true; rawKey: string }
    | { ok: false; reason: "not_found" | "not_recoverable" | "encryption_not_configured" };

export async function revealApiKey(
    projectId: string,
    keyId: string,
    ownerId: string,
): Promise<RevealApiKeyResult> {
    // Ownership is enforced via the project relation filter.
    const record = await prisma.apiKey.findFirst({
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
        select: {
            encryptedKey: true,
            encryptionIv: true,
            encryptionTag: true,
        },
    });

    if (!record) {
        return { ok: false, reason: "not_found" };
    }

    if (!record.encryptedKey || !record.encryptionIv || !record.encryptionTag) {
        return { ok: false, reason: "not_recoverable" };
    }

    try {
        const rawKey = decryptApiKey(record);
        return { ok: true, rawKey };
    } catch (error) {
        if (
            error instanceof Error &&
            error.message === "API_KEY_ENCRYPTION_KEY is not configured."
        ) {
            return { ok: false, reason: "encryption_not_configured" };
        }

        throw error;
    }
}
