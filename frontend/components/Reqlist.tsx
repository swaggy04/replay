"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import type { Project, RequestDetails, RequestLog, RequestsResponse } from "@/types/request";

import { createProject, getProjects, getRequestDetails, getRequests } from "./requestsApi";

import { RequestSidebar } from "./requests/RequestSidebar";
import { RequestTable } from "./requests/RequestTable";
import { RequestDetailsPanel } from "./requests/RequestDetailsPanel";
import { ProjectSettings } from "./requests/ProjectSettings";

const SELECTED_PROJECT_KEY = "devreplay:selectedProject";
const SELECTED_REQUEST_KEY = "devreplay:selectedRequest";

export default function RequestList() {
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [requests, setRequests] = useState<RequestLog[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Create project dialog state.
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [createProjectError, setCreateProjectError] = useState<string | null>(null);

  // Project settings state.
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Fetch projects.
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

  // Fetch requests for the selected project.
  useEffect(() => {
    if (!selectedProject) return;

    const projectId = selectedProject.id;
    let cancelled = false;

    async function fetchRequests() {
      setLoading(true);

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data: RequestsResponse = await getRequests(page, projectId, token);

        if (cancelled) return;

        setRequests(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);

        const savedRequestId = localStorage.getItem(SELECTED_REQUEST_KEY);

        if (savedRequestId) {
          const savedRequest = data.data.find((request) => request.id === savedRequestId);

          if (savedRequest) {
            await handleSelectRequest(savedRequest);
          } else {
            localStorage.removeItem(SELECTED_REQUEST_KEY);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch requests:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchRequests();

    return () => {
      cancelled = true;
    };
  }, [page, selectedProject, getToken]);

  // Handle project change.
  function handleSelectProject(project: Project) {
    setSelectedProject(project);
    setSettingsOpen(false);

    localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
    localStorage.removeItem(SELECTED_REQUEST_KEY);

    setPage(1);
    setRequests([]);
    setTotal(0);
    setTotalPages(1);

    setSelectedRequest(null);
    setRequestDetails(null);
  }

  // Open create-project dialog.
  function handleOpenCreateDialog() {
    setProjectName("");
    setCreateProjectError(null);
    setCreateDialogOpen(true);
  }

  // Create project.
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

      setSelectedProject(project);

      setRequests([]);
      setSelectedRequest(null);
      setRequestDetails(null);

      setPage(1);
      setTotal(0);
      setTotalPages(1);

      setSettingsOpen(false);

      localStorage.setItem(SELECTED_PROJECT_KEY, project.id);
      localStorage.removeItem(SELECTED_REQUEST_KEY);

      setProjectName("");
      setCreateDialogOpen(false);
    } catch (error) {
      console.error("Failed to create project:", error);

      setCreateProjectError(error instanceof Error ? error.message : "Failed to create project.");
    } finally {
      setCreatingProject(false);
    }
  }

  // Fetch selected request details.
  async function handleSelectRequest(request: RequestLog) {
    setSelectedRequest(request);
    setRequestDetails(null);
    setDetailsLoading(true);

    localStorage.setItem(SELECTED_REQUEST_KEY, request.id);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      const data: RequestDetails = await getRequestDetails(request.id, token);

      setRequestDetails(data);
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setDetailsLoading(false);
    }
  }

  // Project creation dialog.
  const projectDialog = (
    <div
      className={`fixed inset-0 z-50 items-center justify-center bg-black/70 p-4 ${
        createDialogOpen ? "flex" : "hidden"
      }`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !creatingProject) {
          setCreateDialogOpen(false);
        }
      }}
    >
      <form
        onSubmit={handleCreateProject}
        className="w-full max-w-md rounded-xl border border-[#302b2d] bg-[#100d0f] p-6 shadow-2xl"
      >
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-[#f1eeee]">Create project</h2>

          <p className="mt-1 text-sm text-[#918b8e]">Create a project to organize your captured HTTP traffic.</p>
        </div>

        <label htmlFor="project-name" className="mb-2 block text-xs font-medium text-[#c9c5c6]">
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
          className="h-10 w-full rounded-md border border-[#302b2d] bg-[#0c080a] px-3 text-sm text-white outline-none placeholder:text-[#615b5e] focus:border-[#716b6e] disabled:opacity-50"
        />

        {createProjectError && <p className="mt-2 text-xs text-red-400">{createProjectError}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCreateDialogOpen(false)}
            disabled={creatingProject}
            className="rounded-md px-4 py-2 text-xs text-[#aaa4a7] hover:bg-[#242022] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={!projectName.trim() || creatingProject}
            className="rounded-md bg-[#e2dfe0] px-4 py-2 text-xs font-semibold text-[#171315] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creatingProject ? "Creating..." : "Create project"}
          </button>
        </div>
      </form>
    </div>
  );

  // Initial authentication and project loading.
  if (!isLoaded || projectsLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a]">
        <div className="flex flex-col items-center">
          <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#302b2d] border-t-[#d8d4d5]" />

          <p className="text-sm font-medium text-[#c9c5c6]">Loading projects</p>

          <p className="mt-1 text-xs text-[#716b6e]">Getting your DevReplay projects...</p>
        </div>
      </div>
    );
  }

  // Authentication or project loading error.
  if (projectsError) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a]">
        <div className="max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#f1eeee]">Unable to load projects</h2>

          <p className="mt-2 text-sm text-red-400">{projectsError}</p>
        </div>
      </div>
    );
  }

  // Empty state.
  if (projects.length === 0) {
    return (
      <>
        {projectDialog}

        <div className="flex h-screen items-center justify-center bg-[#0c080a]">
          <div className="text-center">
            <h2 className="text-lg font-semibold text-[#f1eeee]">No projects yet</h2>

            <p className="mt-2 text-sm text-[#8f898c]">Create your first project to start capturing HTTP traffic.</p>

            <button
              type="button"
              onClick={handleOpenCreateDialog}
              className="mt-5 rounded-md bg-[#e2dfe0] px-4 py-2 text-sm font-semibold text-[#171315] transition hover:bg-white"
            >
              + Create project
            </button>
          </div>
        </div>
      </>
    );
  }

  // Loading requests.
  if (loading && requests.length === 0 && !settingsOpen) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a]">
        <div className="flex flex-col items-center">
          <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#302b2d] border-t-[#d8d4d5]" />

          <p className="text-sm font-medium text-[#c9c5c6]">Loading requests</p>

          <p className="mt-1 text-xs text-[#716b6e]">Fetching captured HTTP traffic...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c080a] text-[#e2e2e4]">
      {projectDialog}

      {/* SIDEBAR */}
      <RequestSidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        onCreateProject={handleOpenCreateDialog}
        onOpenSettings={() => setSettingsOpen(true)}
        requests={requests}
        selectedRequest={selectedRequest}
        onSelectRequest={handleSelectRequest}
      />

      {/* MAIN AREA */}
      <main className="relative flex min-w-0 flex-1 flex-col">
        {settingsOpen && selectedProject ? (
          <>
            {/* SETTINGS HEADER */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#242022] bg-[#0c080a] px-5">
              <div>
                <h1 className="text-sm font-semibold text-[#f1eeee]">Project Settings</h1>

                <p className="mt-0.5 text-[10px] text-[#716b6e]">Manage {selectedProject.name}</p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#c9c5c6] transition hover:bg-[#1a1618]"
              >
                ← Back to requests
              </button>
            </header>

            {/* ACTUAL PROJECT SETTINGS COMPONENT */}
            <ProjectSettings
              key={selectedProject.id}
              projectId={selectedProject.id}
              projectName={selectedProject.name}
              getToken={getToken}
            />
          </>
        ) : (
          <>
            {/* REQUESTS HEADER */}
            <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#242022] bg-[#0c080a] px-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-sm font-semibold tracking-tight text-[#f1eeee]">Requests</h1>

                  <span className="text-[#403a3d]">/</span>

                  <span className="max-w-[240px] truncate text-xs text-[#8f898c]">{selectedProject?.name}</span>
                </div>

                <p className="mt-0.5 text-[10px] text-[#716b6e]">Captured HTTP traffic</p>
              </div>

              <div className="shrink-0 text-[11px] font-medium text-[#777174]">
                {total} {total === 1 ? "request" : "requests"}
              </div>
            </header>

            {/* REQUEST TABLE */}
            <RequestTable requests={requests} selectedRequest={selectedRequest} onSelectRequest={handleSelectRequest} />

            {/* DETAILS PANEL */}
            <RequestDetailsPanel
              selectedRequest={selectedRequest}
              requestDetails={requestDetails}
              detailsLoading={detailsLoading}
              onClose={() => {
                setSelectedRequest(null);
                setRequestDetails(null);
                localStorage.removeItem(SELECTED_REQUEST_KEY);
              }}
            />

            {/* PAGINATION */}
            <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#242022] px-5">
              <span className="text-xs text-[#716b6e]">
                Page {page} of {totalPages}
              </span>

              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((current) => current - 1)}
                  className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#a9a4a6] transition hover:border-[#403a3d] hover:bg-[#141012] hover:text-[#e5e1e2] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← Previous
                </button>

                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-md border border-[#302b2d] px-3 py-1.5 text-xs text-[#a9a4a6] transition hover:border-[#403a3d] hover:bg-[#141012] hover:text-[#e5e1e2] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Next →
                </button>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
