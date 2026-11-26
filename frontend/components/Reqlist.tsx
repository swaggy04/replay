"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import type { Project, RequestDetails, RequestLog, RequestsResponse } from "@/types/request";

import { SELECTED_REQUEST_KEY } from "@/lib/preferences";

import { getRequestDetails, getRequests } from "./requestsApi";

import { DashboardShell } from "./DashboardShell";
import { RequestTable } from "./requests/RequestTable";
import { RequestDetailsPanel } from "./requests/RequestDetailsPanel";

export default function RequestList() {
  const [sidebarRequests, setSidebarRequests] = useState<RequestLog[]>([]);
  const [selectedSidebarRequest, setSelectedSidebarRequest] = useState<RequestLog | null>(null);
  const [onSelectSidebarRequest, setOnSelectSidebarRequest] = useState<(r: RequestLog) => void>(() => () => {});

  const handleSidebarChange = useCallback(
    (next: {
      requests: RequestLog[];
      selectedRequest: RequestLog | null;
      onSelectRequest: (request: RequestLog) => void;
    }) => {
      setSidebarRequests(next.requests);
      setSelectedSidebarRequest(next.selectedRequest);
      setOnSelectSidebarRequest(() => next.onSelectRequest);
    },
    [],
  );

  return (
    <DashboardShell
      sidebarRequests={sidebarRequests}
      selectedSidebarRequest={selectedSidebarRequest}
      onSelectSidebarRequest={onSelectSidebarRequest}
    >
      {(selectedProject) => (
        <RequestsView
          key={selectedProject.id}
          project={selectedProject}
          onSidebarChange={handleSidebarChange}
        />
      )}
    </DashboardShell>
  );
}

type RequestsViewProps = {
  project: Project;
  onSidebarChange: (next: {
    requests: RequestLog[];
    selectedRequest: RequestLog | null;
    onSelectRequest: (request: RequestLog) => void;
  }) => void;
};

function RequestsView({ project, onSidebarChange }: RequestsViewProps) {
  const { getToken } = useAuth();

  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);
  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const handleSelectRequest = useCallback((request: RequestLog) => {
    setSelectedRequest(request);
    setRequestDetails(null);
    localStorage.setItem(SELECTED_REQUEST_KEY, request.id);
  }, []);

  // Keep shell sidebar in sync with current requests/selection.
  useEffect(() => {
    onSidebarChange({
      requests,
      selectedRequest,
      onSelectRequest: handleSelectRequest,
    });
  }, [requests, selectedRequest, handleSelectRequest, onSidebarChange]);

  useEffect(() => {
    let cancelled = false;

    async function fetchRequests() {
      setLoading(true);

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data: RequestsResponse = await getRequests(page, project.id, token);

        if (cancelled) return;

        setRequests(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);

        const savedRequestId = localStorage.getItem(SELECTED_REQUEST_KEY);

        if (savedRequestId) {
          const savedRequest = data.data.find((request) => request.id === savedRequestId);

          if (savedRequest) {
            handleSelectRequest(savedRequest);
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
  }, [page, project.id, getToken, handleSelectRequest]);

  useEffect(() => {
    if (!selectedRequest) {
      return;
    }

    const requestId = selectedRequest.id;
    let cancelled = false;

    async function loadDetails() {
      setDetailsLoading(true);
      setRequestDetails(null);

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data: RequestDetails = await getRequestDetails(requestId, token);

        if (!cancelled) {
          setRequestDetails(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch request details:", error);
        }
      } finally {
        if (!cancelled) {
          setDetailsLoading(false);
        }
      }
    }

    void loadDetails();

    return () => {
      cancelled = true;
    };
  }, [selectedRequest, getToken]);

  if (loading && requests.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#fafafa]" />
          <p className="text-sm font-medium text-[#d4d4d8]">Loading requests</p>
          <p className="mt-1 text-xs text-[#71717a]">Fetching captured HTTP traffic...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#09090b] px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-[#fafafa]">Requests</h1>
            <span className="text-[#3f3f46]">/</span>
            <span className="max-w-[240px] truncate text-xs text-[#a1a1aa]">{project.name}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#71717a]">Captured HTTP traffic</p>
        </div>

        <div className="shrink-0 text-[11px] font-medium text-[#71717a]">
          {total} {total === 1 ? "request" : "requests"}
        </div>
      </header>

      <RequestTable requests={requests} selectedRequest={selectedRequest} onSelectRequest={handleSelectRequest} />

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

      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#27272a] px-5">
        <span className="text-xs text-[#71717a]">
          Page {page} of {totalPages}
        </span>

        <div className="flex gap-2">
          <button
            disabled={page === 1}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#a1a1aa] transition hover:border-[#3f3f46] hover:bg-[#18181b] hover:text-[#fafafa] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Previous
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#a1a1aa] transition hover:border-[#3f3f46] hover:bg-[#18181b] hover:text-[#fafafa] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </footer>
    </>
  );
}
