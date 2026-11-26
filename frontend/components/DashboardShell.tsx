"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";

import type { Project, RequestLog } from "@/types/request";
import { SELECTED_PROJECT_KEY } from "@/lib/preferences";
import { createProject, getProjects } from "./requestsApi";
import { RequestSidebar } from "./requests/RequestSidebar";

type DashboardShellProps = {
  routeProjectId?: string;
  onRouteProjectChange?: (project: Project) => void;
  sidebarRequests?: RequestLog[];
  selectedSidebarRequest?: RequestLog | null;
  onSelectSidebarRequest?: (request: RequestLog) => void;
  children: (selectedProject: Project) => ReactNode;
};

export function DashboardShell({
  routeProjectId,
  onRouteProjectChange,
  sidebarRequests = [],
  selectedSidebarRequest = null,
  onSelectSidebarRequest,
  children,
}: DashboardShellProps) {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  const routeProject = routeProjectId ? projects.find((project) => project.id === routeProjectId) ?? null : null;
  const resolvedSelectedProject = routeProjectId ? (routeProject ?? selectedProject) : selectedProject;
  const resolvedSelectedProjectId = resolvedSelectedProject?.id;

  useEffect(() => {
    if (resolvedSelectedProjectId) {
      localStorage.setItem(SELECTED_PROJECT_KEY, resolvedSelectedProjectId);
    }
  }, [resolvedSelectedProjectId]);

  useEffect(() => {
    if (!isLoaded) return;

    let cancelled = false;

    async function fetchProjects() {
      try {
        if (!isSignedIn) {
          throw new Error("Please sign in to view your projects.");
        }

        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data: Project[] = await getProjects(token);

        if (cancelled) return;

        setProjects(data);

        if (data.length === 0) {
          setSelectedProject(null);
          return;
        }

        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);
        const savedProject = data.find((project) => project.id === savedProjectId);

        setSelectedProject(savedProject ?? data[0]);
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to fetch projects:", error);
        setProjectsError(error instanceof Error ? error.message : "Failed to fetch projects.");
      } finally {
        if (!cancelled) {
          setProjectsLoading(false);
        }
      }
    }

    void fetchProjects();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  function handleSelectProject(project: Project) {
    localStorage.setItem(SELECTED_PROJECT_KEY, project.id);

    if (routeProjectId) {
      setSelectedProject(project);
      onRouteProjectChange?.(project);
      return;
    }

    setSelectedProject(project);
  }

  function handleOpenCreateDialog() {
    setProjectName("");
    setCreateProjectError(null);
    setCreateDialogOpen(true);
  }

  async function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = projectName.trim();

    if (!name) {
      setCreateProjectError("Project name is required.");
      return;
    }

    setCreatingProject(true);
    setCreateProjectError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      const project: Project = await createProject(name, token);

      setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
      setSelectedProject(project);

      if (routeProjectId) {
        onRouteProjectChange?.(project);
      }

      setProjectName("");
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);
      setCreateProjectError(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setCreatingProject(false);
    }
  }

  const projectDialog = (
    <div
      className={`fixed inset-0 z-50 items-center justify-center bg-black/70 p-4 ${createDialogOpen ? "flex" : "hidden"}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creatingProject) {
          setCreateDialogOpen(false);
        }
      }}
    >
      <form
        onSubmit={handleCreateProject}
        className="w-full max-w-md rounded-md border border-[#27272a] bg-[#1b1b1e] p-6 shadow-2xl"
      >
        <div className="mb-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717a]">New project</p>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-[#fafafa]">Create project</h2>
          <p className="mt-1 text-sm text-[#a1a1aa]">Create a project to organize your captured HTTP traffic.</p>
        </div>

        <label htmlFor="project-name" className="mb-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">
          Project name
        </label>

        <input
          id="project-name"
          autoFocus={createDialogOpen}
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="My Express API"
          maxLength={80}
          disabled={creatingProject}
          className="h-10 w-full rounded-md border border-[#27272a] bg-[#0e0e11] px-3 text-sm text-[#fafafa] outline-none placeholder:text-[#52525b] focus:border-[#52525b] disabled:opacity-50"
        />

        {createProjectError && <p className="mt-2 text-xs text-red-400">{createProjectError}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCreateDialogOpen(false)}
            disabled={creatingProject}
            className="rounded-md px-4 py-2 text-xs text-[#a1a1aa] transition hover:bg-[#27272a] hover:text-[#fafafa] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!projectName.trim() || creatingProject}
            className="rounded-md bg-[#fafafa] px-4 py-2 text-xs font-semibold text-[#09090b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingProject ? "Creating..." : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );

  if (!isLoaded || projectsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131316]">
        <div className="flex flex-col items-center">
          <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#fafafa]" />
          <p className="text-sm font-medium text-[#e4e1e6]">Loading projects</p>
          <p className="mt-1 font-mono text-[10px] text-[#71717a]">Getting your DevReplay projects...</p>
        </div>
      </div>
    );
  }

  if (projectsError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#131316]">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#fafafa]">Unable to load projects</h2>
          <p className="mt-2 text-sm text-red-400">{projectsError}</p>
        </div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <>
        {projectDialog}
        <div className="flex h-screen items-center justify-center bg-[#131316]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#fafafa]">No projects yet</h2>
            <p className="mt-2 text-sm text-[#a1a1aa]">Create your first project to start capturing HTTP traffic.</p>
            <button
              type="button"
              onClick={handleOpenCreateDialog}
              className="mt-5 rounded-md bg-[#fafafa] px-4 py-2 text-sm font-semibold text-[#09090b] transition hover:bg-white"
            >
              + Create project
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!resolvedSelectedProject) {
    return null;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#131316] text-[#e4e1e6]">
      {projectDialog}

      <RequestSidebar
        projects={projects}
        selectedProject={resolvedSelectedProject}
        onSelectProject={handleSelectProject}
        onCreateProject={handleOpenCreateDialog}
        requests={sidebarRequests}
        selectedRequest={selectedSidebarRequest}
        onSelectRequest={onSelectSidebarRequest ?? (() => {})}
      />

      <main className="relative flex min-w-0 flex-1 flex-col bg-[#131316]">{children(resolvedSelectedProject)}</main>
    </div>
  );
}
