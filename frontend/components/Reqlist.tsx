"use client";

import { useEffect, useState } from "react";

import type { Project, RequestDetails, RequestLog, RequestsResponse } from "@/types/request";



import { getProjects, getRequestDetails, getRequests } from "./requestsApi";

import { RequestSidebar } from "./requests/RequestSidebar";
import { RequestTable } from "./requests/RequestTable";
import { RequestDetailsPanel } from "./requests/RequestDetailsPanel";

const SELECTED_PROJECT_KEY = "devreplay:selectedProject";
const SELECTED_REQUEST_KEY = "devreplay:selectedRequest";

export default function RequestList() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const [requests, setRequests] = useState<RequestLog[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);

  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  // Fetch projects
  useEffect(() => {
    async function fetchProjects() {
      try {
        const data: Project[] = await getProjects();

        setProjects(data);

        if (data.length === 0) {
          return;
        }

        const savedProjectId = localStorage.getItem(SELECTED_PROJECT_KEY);

        const savedProject = data.find((project) => project.id === savedProjectId);

        setSelectedProject(savedProject ?? data[0]);
      } catch (error) {
        console.error("Failed to fetch projects:", error);
      }
    }

    fetchProjects();
  }, []);

  // Fetch requests for selected project
  useEffect(() => {
    if (!selectedProject) {
      return;
    }

    const projectId = selectedProject.id;

    async function fetchRequests() {
      setLoading(true);

      try {
        const data: RequestsResponse = await getRequests(page, projectId);

        console.log("REQUESTS STATE DATA:", data.data);

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
        console.error("Failed to fetch requests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [page, selectedProject]);

  // Handle project change
  function handleSelectProject(project: Project) {
    setSelectedProject(project);

    localStorage.setItem(SELECTED_PROJECT_KEY, project.id);

    localStorage.removeItem(SELECTED_REQUEST_KEY);

    setPage(1);

    setRequests([]);
    setTotal(0);
    setTotalPages(1);

    setSelectedRequest(null);
    setRequestDetails(null);
  }

  // Fetch details of selected request
  async function handleSelectRequest(request: RequestLog) {
    setSelectedRequest(request);
    setRequestDetails(null);
    setDetailsLoading(true);

    localStorage.setItem(SELECTED_REQUEST_KEY, request.id);

    try {
      const data: RequestDetails = await getRequestDetails(request.id);

      setRequestDetails(data);
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setDetailsLoading(false);
    }
  }

  // Loading projects
  if (!selectedProject && !projects.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a]">
        <div className="flex flex-col items-center">
          <div
            className="
              mb-4
              h-5
              w-5
              animate-spin
              rounded-full
              border-2
              border-[#302b2d]
              border-t-[#d8d4d5]
            "
          />

          <p className="text-sm font-medium text-[#c9c5c6]">Loading projects</p>

          <p className="mt-1 text-xs text-[#716b6e]">Getting your DevReplay projects...</p>
        </div>
      </div>
    );
  }

  // Loading requests
  if (loading && requests.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a]">
        <div className="flex flex-col items-center">
          <div
            className="
              mb-4
              h-5
              w-5
              animate-spin
              rounded-full
              border-2
              border-[#302b2d]
              border-t-[#d8d4d5]
            "
          />

          <p className="text-sm font-medium text-[#c9c5c6]">Loading requests</p>

          <p className="mt-1 text-xs text-[#716b6e]">Fetching captured HTTP traffic...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c080a] text-[#e2e2e4]">
      {/* SIDEBAR */}

      <RequestSidebar
        projects={projects}
        selectedProject={selectedProject}
        onSelectProject={handleSelectProject}
        requests={requests}
        selectedRequest={selectedRequest}
        onSelectRequest={handleSelectRequest}
      />

      {/* MAIN AREA */}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR */}

        <header
          className="
            flex
            h-14
            shrink-0
            items-center
            justify-between
            border-b border-[#242022]
            bg-[#0c080a]
            px-5
          "
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1
                className="
                  text-sm
                  font-semibold
                  tracking-tight
                  text-[#f1eeee]
                "
              >
                Requests
              </h1>

              <span className="text-[#403a3d]">/</span>

              <span
                className="
                  max-w-[240px]
                  truncate
                  text-xs
                  text-[#8f898c]
                "
              >
                {selectedProject?.name}
              </span>
            </div>

            <p
              className="
                mt-0.5
                text-[10px]
                text-[#716b6e]
              "
            >
              Captured HTTP traffic
            </p>
          </div>

          <div
            className="
              shrink-0
              text-[11px]
              font-medium
              text-[#777174]
            "
          >
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

        <footer
          className="
            flex
            h-12
            shrink-0
            items-center
            justify-between
            border-t border-[#242022]
            px-5
          "
        >
          <span className="text-xs text-[#716b6e]">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="
                rounded-md
                border border-[#302b2d]
                px-3
                py-1.5
                text-xs
                text-[#a9a4a6]
                transition
                hover:border-[#403a3d]
                hover:bg-[#141012]
                hover:text-[#e5e1e2]
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              ← Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="
                rounded-md
                border border-[#302b2d]
                px-3
                py-1.5
                text-xs
                text-[#a9a4a6]
                transition
                hover:border-[#403a3d]
                hover:bg-[#141012]
                hover:text-[#e5e1e2]
                disabled:cursor-not-allowed
                disabled:opacity-30
              "
            >
              Next →
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
