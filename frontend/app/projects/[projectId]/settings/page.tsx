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
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#242022] bg-[#0c080a] px-5">
            <div>
              <h1 className="text-sm font-semibold text-[#f1eeee]">Project Settings</h1>
              <p className="mt-0.5 text-[10px] text-[#716b6e]">Manage {selectedProject.name}</p>
            </div>

            <Link
              href="/"
              className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#c9c5c6] transition hover:bg-[#1a1618]"
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
