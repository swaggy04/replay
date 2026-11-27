"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";

import type { Project, RequestDetails, RequestLog, RequestsResponse } from "@/types/request";
import { cacheGetStale, cacheSet, getCacheScope } from "@/lib/cache";
import { DashboardShell } from "@/components/DashboardShell";
import { RequestTable } from "@/components/requests/RequestTable";
import RequestInspector from "@/components/requestinspector/RequestInspector";
import { getRequestDetails, getRequests } from "@/components/requestsApi";

export default function RequestWorkbenchPage() {
  const { projectId, requestId } = useParams<{ projectId: string; requestId: string }>();
  const router = useRouter();

  const [sidebarRequests, setSidebarRequests] = useState<RequestLog[]>([]);
  const [selectedSidebarRequest, setSelectedSidebarRequest] = useState<RequestLog | null>(null);
  const [onSelectSidebarRequest, setOnSelectSidebarRequest] = useState<(r: RequestLog) => void>(() => () => {});

  const navigateToRequest = useCallback(
    (id: string) => {
      router.push(`/projects/${projectId}/requests/${id}`);
    },
    [router, projectId],
  );

  const handleSidebarChange = useCallback(
    (next: {
      requests: RequestLog[];
      selectedRequest: RequestLog | null;
      onSelectRequest: (request: RequestLog) => void;
    }) => {
      setSidebarRequests((prev) => (prev === next.requests ? prev : next.requests));
      setSelectedSidebarRequest((prev) => (prev?.id === next.selectedRequest?.id ? prev : next.selectedRequest));
      setOnSelectSidebarRequest((prev: (request: RequestLog) => void) => (prev === next.onSelectRequest ? prev : next.onSelectRequest));
    },
    [],
  );

  return (
    <DashboardShell
      routeProjectId={projectId}
      sidebarRequests={sidebarRequests}
      selectedSidebarRequest={selectedSidebarRequest}
      onSelectSidebarRequest={onSelectSidebarRequest}
      onRouteProjectChange={() => {
        router.push("/");
      }}
    >
      {(selectedProject) => (
        <RequestWorkbench
          key={`${selectedProject.id}:${requestId}`}
          project={selectedProject}
          requestId={requestId}
          onNavigateRequest={navigateToRequest}
          onSidebarChange={handleSidebarChange}
        />
      )}
    </DashboardShell>
  );
}

function RequestWorkbench({
  project,
  requestId,
  onNavigateRequest,
  onSidebarChange,
}: {
  project: Project;
  requestId: string;
  onNavigateRequest: (id: string) => void;
  onSidebarChange: (next: {
    requests: RequestLog[];
    selectedRequest: RequestLog | null;
    onSelectRequest: (request: RequestLog) => void;
  }) => void;
}) {
  const { getToken } = useAuth();
  const router = useRouter();

  const listCacheKey = `requests:${project.id}:1`;
  const cachedList = cacheGetStale<RequestsResponse>(listCacheKey);
  const cachedDetails = cacheGetStale<RequestDetails>(`request:${requestId}`);

  const [requests, setRequests] = useState<RequestLog[]>(cachedList?.data ?? []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(cachedList?.totalPages ?? 1);
  const [total, setTotal] = useState(cachedList?.total ?? 0);
  const [loadingList, setLoadingList] = useState(!cachedList);

  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(cachedDetails ?? null);
  const [detailsLoading, setDetailsLoading] = useState(!cachedDetails);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const listSeqRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const selectedRequest = useMemo(
    () =>
      requests.find((r) => r.id === requestId) ??
      (requestDetails
        ? {
            id: requestDetails.id,
            method: requestDetails.method,
            path: requestDetails.path,
            statusCode: requestDetails.statusCode,
            createdAt: requestDetails.createdAt,
            durationMs: requestDetails.durationMs,
          }
        : null),
    [requestDetails, requestId, requests],
  );

  const handleSidebarSelect = useCallback((r: RequestLog) => onNavigateRequest(r.id), [onNavigateRequest]);

  useEffect(() => {
    onSidebarChange({
      requests,
      selectedRequest,
      onSelectRequest: handleSidebarSelect,
    });
  }, [requests, selectedRequest, handleSidebarSelect, onSidebarChange]);

  const loadRequests = useCallback(
    async (pageNumber: number) => {
      const seq = ++listSeqRef.current;
      const scope = getCacheScope();
      const key = `requests:${project.id}:${pageNumber}`;
      const cachedPage = cacheGetStale<RequestsResponse>(key);
      if (cachedPage) {
        setRequests(cachedPage.data);
        setTotalPages(cachedPage.totalPages);
        setTotal(cachedPage.total);
        setPage(cachedPage.page);
        setLoadingList(false);
      } else {
        setLoadingList(true);
      }
      try {
        const token = await getToken();
        if (!token) throw new Error("Unable to obtain Clerk session token.");
        const data: RequestsResponse = await getRequests(pageNumber, project.id, token);
        if (seq !== listSeqRef.current || getCacheScope() !== scope) return;
        cacheSet(key, data, scope);
        if (!mountedRef.current) return;
        setRequests(data.data);
        setTotalPages(data.totalPages);
        setTotal(data.total);
        setPage(data.page);
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        if (seq === listSeqRef.current && mountedRef.current) setLoadingList(false);
      }
    },
    [getToken, project.id],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRequests(1);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRequests]);

  useEffect(() => {
    let cancelled = false;
    const key = `request:${requestId}`;

    async function loadDetails() {
      const scope = getCacheScope();
      try {
        const token = await getToken();
        if (!token) throw new Error("Unable to obtain Clerk session token.");
        const data = await getRequestDetails(requestId, token);
        if (getCacheScope() !== scope) return;
        cacheSet(key, data, scope);
        if (cancelled) return;
        setRequestDetails(data);
        setDetailsError(null);
      } catch (error) {
        if (!cancelled && getCacheScope() === scope && !cacheGetStale<RequestDetails>(key)) {
          setDetailsError(error instanceof Error ? error.message : "Failed to load request details.");
        }
      } finally {
        if (!cancelled) setDetailsLoading(false);
      }
    }
    void loadDetails();
    return () => {
      cancelled = true;
    };
  }, [getToken, requestId]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#0e0e11] px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[9px] text-[#71717a]">
            <span>Requests</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="truncate text-[#a1a1aa]">{project.name}</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="truncate text-[#d4d4d8]">Inspector</span>
          </div>
          <h1 className="mt-0.5 text-sm font-semibold tracking-tight text-[#fafafa]">Request Workbench</h1>
        </div>
        <div className="shrink-0 font-mono text-[9px] text-[#71717a]">
          {total} {total === 1 ? "request" : "requests"}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <section className="flex min-h-0 w-full max-w-[420px] shrink-0 flex-col border-r border-[#27272a] bg-[#131316]">
          <div className="border-b border-[#27272a] px-4 py-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#71717a]">Captured Requests</p>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {loadingList && requests.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 py-12">
                <p className="text-xs text-[#71717a]">Loading requests...</p>
              </div>
            ) : (
              <RequestTable
                requests={requests}
                selectedRequest={selectedRequest}
                onSelectRequest={(r) => onNavigateRequest(r.id)}
              />
            )}
          </div>

          <footer className="flex h-11 shrink-0 items-center justify-between border-t border-[#27272a] px-4">
            <span className="font-mono text-[9px] text-[#71717a]">Page {page}/{totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => void loadRequests(page - 1)}
                className="rounded border border-[#27272a] px-2.5 py-1 text-[9px] text-[#a1a1aa] hover:bg-[#1f1f22] disabled:opacity-30"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void loadRequests(page + 1)}
                className="rounded border border-[#27272a] px-2.5 py-1 text-[9px] text-[#a1a1aa] hover:bg-[#1f1f22] disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </footer>
        </section>

        <section className="min-h-0 min-w-0 flex-1 bg-[#131316]">
          {detailsLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center">
                <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#fafafa]" />
                <p className="text-sm font-medium text-[#d4d4d8]">Loading request details</p>
                <p className="mt-1 font-mono text-[9px] text-[#71717a]">Fetching captured request data...</p>
              </div>
            </div>
          ) : detailsError ? (
            <div className="flex h-full items-center justify-center px-6">
              <div className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{detailsError}</div>
            </div>
          ) : requestDetails ? (
            <RequestInspector
              request={requestDetails}
              embedded
              onClose={() => router.push("/")}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-[#71717a]">Request not found.</div>
          )}
        </section>
      </div>
    </>
  );
}
