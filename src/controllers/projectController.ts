import type { Request, Response } from "express";
import { createproject, getProjects, updateProjectReplayBaseUrl } from "../services/projectService.js";

export async function projectController(req: Request, res: Response) {
  try {
    const { name } = req.body;
    const ownerId = res.locals.userId as string;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        message: "Invalid project name",
      });
    }

    const project = await createproject(name.trim(), ownerId);

    return res.status(201).json(project);
  } catch (error) {
    console.error("Failed to create project:", error);

    return res.status(500).json({
      message: "Failed to create project",
    });
  }
}

export async function updateProjectReplayBaseUrlController(req: Request, res: Response) {
  // TEMP DIAGNOSTIC (remove after verification) — logs the incoming dashboard
  // request and validation outcome to L:/replay/tmp_replay_target_diag.log.
  // Only non-sensitive fields are logged (URL strings, IDs, booleans).
  const diag = async (fields: Record<string, unknown>) => {
    try {
      const fs = await import("node:fs");
      fs.appendFileSync(
        "L:/replay/tmp_replay_target_diag.log",
        JSON.stringify({ at: new Date().toISOString(), reqMethod: req.method, reqPath: req.path, ...fields }) + "\n",
      );
    } catch {}
  };

  try {
    const ownerId = res.locals.userId as string;
    const projectId = req.params.projectId;
    const { replayBaseUrl } = req.body ?? {};

    await diag({
      projectId,
      hasOwnerId: Boolean(ownerId),
      replayBaseUrl,
      replayBaseUrlType: typeof replayBaseUrl,
    });

    if (typeof projectId !== "string" || !ownerId) {
      await diag({ outcome: "invalid-project" });
      return res.status(400).json({ message: "Invalid project ID" });
    }

    let normalized: string | null = null;
    if (replayBaseUrl !== null && replayBaseUrl !== undefined) {
      if (typeof replayBaseUrl !== "string") {
        await diag({ outcome: "invalid-replayBaseUrl-type" });
        return res.status(400).json({ message: "Invalid replay base URL" });
      }
      // Basic validation; SSRF host validation happens at replay time.
      try {
        const u = new URL(replayBaseUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          await diag({ outcome: "invalid-scheme", urlOrigin: u.origin });
          return res.status(400).json({ message: "Invalid replay base URL scheme" });
        }
        if (!u.hostname || u.username || u.password) {
          await diag({
            outcome: "invalid-hostname-or-userinfo",
            urlOrigin: u.origin,
            hostname: u.hostname,
            hasUserinfo: Boolean(u.username || u.password),
          });
          return res.status(400).json({ message: "Invalid replay base URL" });
        }
        normalized = u.origin;
      } catch (e) {
        await diag({ outcome: "throws", error: e instanceof Error ? e.message : String(e) });
        return res.status(400).json({ message: "Invalid replay base URL" });
      }
    } else {
      await diag({ outcome: "clearing-to-null" });
    }

    await diag({ outcome: "pre-update", normalized });

    const updated = await updateProjectReplayBaseUrl(projectId, ownerId, normalized);

    if (!updated) {
      await diag({ outcome: "project-not-found" });
      return res.status(404).json({ message: "Project not found" });
    }

    await diag({ outcome: "saved", normalized });
    return res.status(200).json(updated);
  } catch (error) {
    await diag({ outcome: "caught", error: String(error) });
    console.error("Failed to update replay base URL:", error);
    return res.status(500).json({ message: "Failed to update replay base URL" });
  }
}

export async function getProjectsController(_req: Request, res: Response) {
  try {
    const ownerId = res.locals.userId as string;

    const projects = await getProjects(ownerId);

    return res.status(200).json(projects);
  } catch (error) {
    console.error("Failed to fetch projects:", error);

    return res.status(500).json({
      message: "Failed to fetch projects",
    });
  }
}
