"use client";

import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { DashboardShell } from "@/components/DashboardShell";
import { ProjectSettings } from "@/components/requests/ProjectSettings";
import type { Project } from "@/types/request";

export default function ProjectSettingsPage() {
  const { getToken } = useAuth();
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  return (
    <DashboardShell
      routeProjectId={projectId}
      onRouteProjectChange={(project: Project) => {
        router.push(`/projects/${project.id}/settings`);
      }}
    >
      {(selectedProject) => (
        <>
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#0e0e11] px-6">
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-mono text-[10px] text-[#71717a]">
                <span>Settings</span>
                <span className="text-[#3f3f46]">/</span>
                <span className="truncate text-[#a1a1aa]">{selectedProject.name}</span>
              </div>
              <h1 className="mt-0.5 text-sm font-semibold tracking-tight text-[#fafafa]">Project Settings</h1>
            </div>

            <Link
              href="/"
              className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#d4d4d8] transition hover:bg-[#1f1f22] hover:text-[#fafafa]"
            >
              ← Back to requests
            </Link>
          </header>

          <ProjectSettings
            key={selectedProject.id}
            projectId={selectedProject.id}
            projectName={selectedProject.name}
            getToken={getToken}
          />
        </>
      )}
    </DashboardShell>
  );
}
