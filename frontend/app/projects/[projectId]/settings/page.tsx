"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams } from "next/navigation";

import { ProjectSettings } from "@/components/requests/ProjectSettings";
import { getProjects } from "@/components/requestsApi";
import { SELECTED_PROJECT_KEY } from "@/lib/preferences";

export default function ProjectSettingsPage() {
  const { isLoaded, getToken } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();

  const [projectName, setProjectName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProjectName() {
      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const projects = await getProjects(token);

        if (cancelled) return;

        const project = projects.find((item) => item.id === projectId);

        if (!project) {
          throw new Error("Project not found");
        }

        // Remember the project while on Settings so returning to the
        // Requests page keeps the same selection (no state is reset).
        localStorage.setItem(SELECTED_PROJECT_KEY, projectId);
        setProjectName(project.name);
      } catch (err) {
        if (cancelled) return;

        setError(err instanceof Error ? err.message : "Failed to load project.");
      }
    }

    void loadProjectName();

    return () => {
      cancelled = true;
    };
  }, [getToken, projectId]);

  if (!isLoaded) {
    return null;
  }

  if (error) {
    return (
      <main className="flex h-screen items-center justify-center bg-[#0c080a]">
        <p className="text-sm text-red-400">{error}</p>
      </main>
    );
  }

  if (!projectName) {
    return null;
  }

  return (
    <main className="flex min-h-full flex-col bg-[#0c080a]">
      {/* HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#242022] bg-[#0c080a] px-5">
        <div>
          <h1 className="text-sm font-semibold text-[#f1eeee]">Project Settings</h1>

          <p className="mt-0.5 text-[10px] text-[#716b6e]">Manage {projectName}</p>
        </div>

        <Link
          href="/"
          className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#c9c5c6] transition hover:bg-[#1a1618]"
        >
          ← Back to requests
        </Link>
      </header>

      <ProjectSettings
        key={projectId}
        projectId={projectId}
        projectName={projectName}
        getToken={getToken}
      />
    </main>
  );
}
