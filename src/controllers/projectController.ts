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
  try {
    const ownerId = res.locals.userId as string;
    const projectId = req.params.projectId;
    const { replayBaseUrl } = req.body ?? {};

    if (typeof projectId !== "string" || !ownerId) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    let normalized: string | null = null;
    if (replayBaseUrl !== null && replayBaseUrl !== undefined) {
      if (typeof replayBaseUrl !== "string") {
        return res.status(400).json({ message: "Invalid replay base URL" });
      }
      // Basic validation; SSRF host validation happens at replay time.
      try {
        const u = new URL(replayBaseUrl.trim());
        if (u.protocol !== "http:" && u.protocol !== "https:") {
          return res.status(400).json({ message: "Invalid replay base URL scheme" });
        }
        if (!u.hostname || u.username || u.password) {
          return res.status(400).json({ message: "Invalid replay base URL" });
        }
        normalized = u.origin;
      } catch {
        return res.status(400).json({ message: "Invalid replay base URL" });
      }
    }

    const updated = await updateProjectReplayBaseUrl(projectId, ownerId, normalized);

    if (!updated) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.status(200).json(updated);
  } catch (error) {
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
