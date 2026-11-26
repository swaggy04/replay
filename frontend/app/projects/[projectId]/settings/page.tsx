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
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#09090b] px-5">
            <div>
              <h1 className="text-sm font-semibold text-[#fafafa]">Project Settings</h1>
              <p className="mt-0.5 text-[10px] text-[#71717a]">Manage {selectedProject.name}</p>
            </div>

            <Link
              href="/"
              className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#d4d4d8] transition hover:bg-[#18181b]"
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
