"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

import type { Project, RequestLog, RequestsResponse } from "@/types/request";
import { cacheGetStale, cacheSet, getCacheScope } from "@/lib/cache";
import { getRequests } from "./requestsApi";
import { DashboardShell } from "./DashboardShell";
import { RequestTable } from "./requests/RequestTable";

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
  const router = useRouter();

  const [page, setPage] = useState(1);
  const cacheKey = `requests:${project.id}:1`;
  const cached = cacheGetStale<RequestsResponse>(cacheKey);
  const [requests, setRequests] = useState<RequestLog[]>(cached?.data ?? []);
  const [totalPages, setTotalPages] = useState(cached?.totalPages ?? 1);
  const [total, setTotal] = useState(cached?.total ?? 0);
  const [loading, setLoading] = useState(!cached);

  const handleSelectRequest = useCallback(
    (request: RequestLog) => {
      router.push(`/projects/${project.id}/requests/${request.id}`);
    },
    [project.id, router],
  );

  useEffect(() => {
    onSidebarChange({
      requests,
      selectedRequest: null,
      onSelectRequest: handleSelectRequest,
    });
  }, [requests, handleSelectRequest, onSidebarChange]);

  useEffect(() => {
    let cancelled = false;
    const key = `requests:${project.id}:${page}`;
    const cachedPage = cacheGetStale<RequestsResponse>(key);
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (cachedPage) {
        setRequests(cachedPage.data);
        setTotalPages(cachedPage.totalPages);
        setTotal(cachedPage.total);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }, 0);

    async function fetchRequests() {
      const scope = getCacheScope();
      try {
        const token = await getToken();
        if (!token) throw new Error("Unable to obtain Clerk session token.");

        const data: RequestsResponse = await getRequests(page, project.id, token);
        if (getCacheScope() !== scope) return;

        cacheSet(key, data, scope);
        if (cancelled) return;
        setRequests(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (error) {
        if (!cancelled) console.error("Failed to fetch requests:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void fetchRequests();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [page, project.id, getToken]);

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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#0e0e11] px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-[#fafafa]">Requests</h1>
            <span className="text-[#3f3f46]">/</span>
            <span className="max-w-[240px] truncate text-xs text-[#a1a1aa]">{project.name}</span>
          </div>
          <p className="mt-0.5 text-[9px] text-[#71717a]">Captured HTTP traffic</p>
        </div>

        <div className="shrink-0 text-[9px] font-medium text-[#71717a]">
          {total} {total === 1 ? "request" : "requests"}
        </div>
      </header>

      <RequestTable requests={requests} selectedRequest={null} onSelectRequest={handleSelectRequest} />

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
