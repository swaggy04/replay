import type { Request, Response } from "express";
import { createproject } from "../services/projectService.js";

export async function projectController(req: Request, res: Response) {
  try {
    const { name } = req.body;

    if (typeof name !== "string" || name.trim() === "") {
      return res.status(400).json({
        message: "Invalid project name",
      });
    }

    const project = await createproject(name.trim());

    return res.status(201).json(project);
  } catch (error) {
    console.error("Failed to create project:", error);

    return res.status(500).json({
      message: "Failed to create project",
    });
  }
}
