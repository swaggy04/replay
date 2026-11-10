
import type { Request, Response } from "express";

import {
    createApiKey,
    getProjectApiKeys,
    revokeApiKey,
} from "../services/apiKeyService.js";

export async function createApiKeyController(
    req: Request,
    res: Response,
) {
    try {
        const ownerId = res.locals.userId as string;
        const projectId = req.params.projectId;

        if (typeof projectId !== "string" || !ownerId) {
            return res.status(400).json({
                message: "Invalid project ID",
            });
        }

        const result = await createApiKey(projectId, ownerId);

        if (!result) {
            return res.status(404).json({
                message: "Project not found",
            });
        }

        // The raw API key is returned only once.
        return res.status(201).json({
            message: "API key created. Copy it now; it won't be shown again.",
            apiKey: {
                id: result.id,
                keyPrefix: result.keyPrefix,
                projectId: result.projectId,
                createdAt: result.createdAt,
                rawKey: result.rawKey,
            },
        });
    } catch (error) {
        console.error("Failed to create API key:", error);

        return res.status(500).json({
            message: "Failed to create API key",
        });
    }
}

export async function getProjectApiKeysController(
    req: Request,
    res: Response,
) {
    try {
        const ownerId = res.locals.userId as string;
        const projectId = req.params.projectId;

        if (typeof projectId !== "string" || !ownerId) {
            return res.status(400).json({
                message: "Invalid project ID",
            });
        }

        const keys = await getProjectApiKeys(projectId, ownerId);

        if (keys === null) {
            return res.status(404).json({
                message: "Project not found",
            });
        }

        return res.status(200).json(keys);
    } catch (error) {
        console.error("Failed to fetch API keys:", error);

        return res.status(500).json({
            message: "Failed to fetch API keys",
        });
    }
}

export async function revokeApiKeyController(
    req: Request,
    res: Response,
) {
    try {
        const ownerId = res.locals.userId as string;
        const { projectId, keyId } = req.params;

        if (
            typeof projectId !== "string" ||
            typeof keyId !== "string" ||
            !ownerId
        ) {
            return res.status(400).json({
                message: "Invalid project or API key ID",
            });
        }

        const revoked = await revokeApiKey(
            projectId,
            keyId,
            ownerId,
        );

        if (!revoked) {
            return res.status(404).json({
                message: "API key not found",
            });
        }

        return res.status(200).json({
            message: "API key revoked successfully",
        });
    } catch (error) {
        console.error("Failed to revoke API key:", error);

        return res.status(500).json({
            message: "Failed to revoke API key",
        });
    }
}
