"use client";

import { useEffect, useState } from "react";

import type { Project, RequestDetails, RequestLog, RequestsResponse } from "@/types/request";


import { getProjects, getRequestDetails, getRequests } from "./requestsApi";

import { RequestSidebar } from "./requests/RequestSidebar";
import { RequestTable } from "./requests/RequestTable";
import { RequestDetailsPanel } from "./requests/RequestDetailsPanel";

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

        if (data.length > 0) {
          setSelectedProject(data[0]);
        }
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
    setPage(1);
    setSelectedRequest(null);
    setRequestDetails(null);
  }

  // Fetch details of selected request
  async function handleSelectRequest(request: RequestLog) {
    setSelectedRequest(request);
    setRequestDetails(null);
    setDetailsLoading(true);

    try {
      const data: RequestDetails = await getRequestDetails(request.id);

      setRequestDetails(data);
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setDetailsLoading(false);
    }
  }

  if (!selectedProject && !projects.length) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a] text-[#d1d1d3]">Loading projects...</div>
    );
  }

  if (loading && requests.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0c080a] text-[#d1d1d3]">Loading requests...</div>
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

        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e1dbd6]/20 px-5">
          <div>
            <h1 className="text-sm font-semibold text-[#fefefe]">Requests</h1>

            <p className="text-xs text-[#d1d1d3]">Captured HTTP traffic</p>
          </div>

          <div className="text-xs text-[#d1d1d3]">{total} requests</div>
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
          }}
        />

        {/* PAGINATION */}

        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#e1dbd6]/20 px-5">
          <span className="text-xs text-[#d1d1d3]">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="
                rounded
                border border-[#e1dbd6]/20
                px-3 py-1.5
                text-xs text-[#d1d1d3]
                transition
                disabled:cursor-not-allowed
                disabled:opacity-30
                hover:bg-[#f9f6f2]/5
              "
            >
              ← Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="
                rounded
                border border-[#e1dbd6]/20
                px-3 py-1.5
                text-xs text-[#d1d1d3]
                transition
                disabled:cursor-not-allowed
                disabled:opacity-30
                hover:bg-[#f9f6f2]/5
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
