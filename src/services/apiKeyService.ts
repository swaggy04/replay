
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

    let apiKey;
    try {
        apiKey = await prisma.apiKey.create({
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
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const missingEncryptionColumn =
            message.includes("encryptedKey") &&
            (message.includes("does not exist") || message.includes("Unknown column"));

        if (!missingEncryptionColumn) {
            throw error;
        }

        // Backward-compatible fallback: keep hash-based auth working before the
        // encryption migration is applied. The key will be non-recoverable.
        apiKey = await prisma.apiKey.create({
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
    }

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

    const baseWhere = {
        projectId,
        revokedAt: null,
    } as const;
    const baseSelect = {
        id: true,
        keyPrefix: true,
        createdAt: true,
    } as const;

    try {
        const keys = await prisma.apiKey.findMany({
            where: baseWhere,
            select: {
                ...baseSelect,
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
    } catch (error) {
        // Backward-compatible fallback when the encryption migration has not been
        // applied yet. In that case, keys remain usable for auth but cannot be
        // revealed until the migration is applied and new keys are generated.
        const message = error instanceof Error ? error.message : String(error);
        const missingEncryptionColumn =
            message.includes("encryptedKey") &&
            (message.includes("does not exist") || message.includes("Unknown column"));

        if (!missingEncryptionColumn) {
            throw error;
        }

        const keys = await prisma.apiKey.findMany({
            where: baseWhere,
            select: baseSelect,
            orderBy: {
                createdAt: "desc",
            },
        });

        return keys.map((key) => ({
            ...key,
            canReveal: false,
        }));
    }
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
    let record:
        | {
              encryptedKey: string | null;
              encryptionIv: string | null;
              encryptionTag: string | null;
          }
        | null;

    try {
        record = await prisma.apiKey.findFirst({
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
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const missingEncryptionColumn =
            message.includes("encryptedKey") &&
            (message.includes("does not exist") || message.includes("Unknown column"));

        if (!missingEncryptionColumn) {
            throw error;
        }

        return { ok: false, reason: "not_recoverable" };
    }

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
