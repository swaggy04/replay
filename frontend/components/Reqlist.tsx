"use client";

import { useEffect, useState } from "react";
import RequestInspector from "./RequestInspector";
import { RequestDetails, RequestLog, RequestsResponse } from "@/types/request";

export default function RequestList() {
  const [requests, setRequests] = useState<RequestLog[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [loading, setLoading] = useState(true);

  const [selectedRequest, setSelectedRequest] = useState<RequestLog | null>(null);

  const [requestDetails, setRequestDetails] = useState<RequestDetails | null>(null);

  const [detailsLoading, setDetailsLoading] = useState(false);

  /*
   * Fetch request list
   */
  useEffect(() => {
    async function fetchRequests() {
      setLoading(true);

      try {
        const response = await fetch(`http://localhost:3000/requests?page=${page}&limit=10`);

        if (!response.ok) {
          throw new Error("Failed to fetch requests");
        }

        const data: RequestsResponse = await response.json();

        setRequests(data.data);
        setTotalPages(data.totalPages);
      } catch (error) {
        console.error("Failed to fetch requests:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchRequests();
  }, [page]);

  /*
   * Fetch details of selected request
   */
  async function handleSelectRequest(request: RequestLog) {
    setSelectedRequest(request);
    setRequestDetails(null);
    setDetailsLoading(true);

    try {
      const response = await fetch(`http://localhost:3000/requests/${request.id}`);

      if (!response.ok) {
        throw new Error("Failed to fetch request details");
      }

      const data: RequestDetails = await response.json();

      setRequestDetails(data);
    } catch (error) {
      console.error("Failed to fetch request details:", error);
    } finally {
      setDetailsLoading(false);
    }
  }

  /*
   * UI helper
   */
  function getStatusClass(status: number | null) {
    if (!status) {
      return "text-zinc-500";
    }

    if (status >= 200 && status < 300) {
      return "text-emerald-400";
    }

    if (status >= 400 && status < 500) {
      return "text-yellow-400";
    }

    if (status >= 500) {
      return "text-red-400";
    }

    return "text-zinc-400";
  }

  /*
   * UI helper
   */
  function getMethodClass(method: string) {
    switch (method) {
      case "GET":
        return "text-blue-400";

      case "POST":
        return "text-green-400";

      case "PUT":
        return "text-yellow-400";

      case "PATCH":
        return "text-orange-400";

      case "DELETE":
        return "text-red-400";

      default:
        return "text-zinc-400";
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1115] text-zinc-400">Loading requests...</div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0f1115] text-zinc-200">
      {/* =========================================================
          LEFT SIDEBAR
      ========================================================= */}

      <aside className="w-[250px] shrink-0 border-r border-zinc-800 bg-[#111318]">
        {/* Logo */}

        <div className="flex h-14 items-center border-b border-zinc-800 px-5">
          <div className="text-lg font-semibold text-white">DevReplay</div>
        </div>

        {/* Navigation */}

        <div className="p-3">
          <button
            className="
              mb-1 flex w-full items-center gap-3 rounded-md
              bg-zinc-800 px-3 py-2.5 text-sm text-white
            "
          >
            <span>▣</span>
            Requests
          </button>

          <button
            className="
              mb-1 flex w-full items-center gap-3 rounded-md
              px-3 py-2.5 text-sm text-zinc-400
              hover:bg-zinc-800 hover:text-white
            "
          >
            <span>↻</span>
            Replays
          </button>

          <button
            className="
              mb-1 flex w-full items-center gap-3 rounded-md
              px-3 py-2.5 text-sm text-zinc-400
              hover:bg-zinc-800 hover:text-white
            "
          >
            <span>▱</span>
            Collections
          </button>

          <button
            className="
              flex w-full items-center gap-3 rounded-md
              px-3 py-2.5 text-sm text-zinc-400
              hover:bg-zinc-800 hover:text-white
            "
          >
            <span>⚙</span>
            Settings
          </button>
        </div>

        {/* Recent requests */}

        <div className="mt-5">
          <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">Recent</div>

          {requests.slice(0, 8).map((request) => (
            <button
              key={request.id}
              onClick={() => handleSelectRequest(request)}
              className={`
                flex w-full items-center gap-2 px-5 py-2 text-left
                hover:bg-zinc-800
                ${selectedRequest?.id === request.id ? "bg-zinc-800" : ""}
              `}
            >
              <span className={`w-12 text-[11px] font-semibold ${getMethodClass(request.method)}`}>
                {request.method}
              </span>

              <span className="truncate text-xs text-zinc-400">{request.path}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* =========================================================
          MAIN AREA
      ========================================================= */}

      <main className="flex min-w-0 flex-1 flex-col">
        {/* TOP BAR */}

        <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-5">
          <div>
            <h1 className="text-sm font-semibold text-white">Requests</h1>

            <p className="text-xs text-zinc-500">Captured HTTP traffic</p>
          </div>

          <div className="text-xs text-zinc-500">{requests.length} requests</div>
        </header>

        {/* REQUEST LIST */}

        <section className="border-b border-zinc-800">
          <div
            className="
              grid grid-cols-[80px_1fr_90px_90px]
              border-b border-zinc-800
              bg-[#15171c]
              px-5 py-2
              text-[11px]
              uppercase
              tracking-wide
              text-zinc-600
            "
          >
            <span>Method</span>
            <span>Path</span>
            <span>Status</span>
            <span>Time</span>
          </div>

          <div className="max-h-[320px] overflow-y-auto">
            {requests.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-zinc-500">No requests captured yet.</div>
            ) : (
              requests.map((request) => (
                <button
                  key={request.id}
                  onClick={() => handleSelectRequest(request)}
                  className={`
                    grid w-full grid-cols-[80px_1fr_90px_90px]
                    items-center
                    border-b border-zinc-800/70
                    px-5 py-3
                    text-left
                    transition
                    hover:bg-zinc-800/60
                    ${selectedRequest?.id === request.id ? "bg-zinc-800/80" : ""}
                  `}
                >
                  <span className={`text-xs font-bold ${getMethodClass(request.method)}`}>{request.method}</span>

                  <span className="truncate text-sm text-zinc-300">{request.path}</span>

                  <span className={`text-xs font-medium ${getStatusClass(request.statusCode)}`}>
                    {request.statusCode ?? "—"}
                  </span>

                  <span className="text-xs text-zinc-500">
                    {request.durationMs !== null ? `${request.durationMs}ms` : "—"}
                  </span>
                </button>
              ))
            )}
          </div>
        </section>

        {/* DETAILS PANEL */}

        <section className="flex min-h-0 flex-1 flex-col">
          {!selectedRequest ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <div className="mb-3 text-3xl text-zinc-700">◇</div>

                <h2 className="text-sm font-medium text-zinc-400">Select a request</h2>

                <p className="mt-1 text-xs text-zinc-600">Choose a captured request to inspect it.</p>
              </div>
            </div>
          ) : (
            <>
              {/* REQUEST TITLE */}

              <div className="border-b border-zinc-800 px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`text-sm font-bold ${getMethodClass(selectedRequest.method)}`}>
                    {selectedRequest.method}
                  </span>

                  <span className="text-sm text-zinc-200">{selectedRequest.path}</span>
                </div>

                <div className="mt-2 flex gap-4 text-xs text-zinc-500">
                  <span className={getStatusClass(selectedRequest.statusCode)}>
                    {selectedRequest.statusCode ?? "Unknown"}
                  </span>

                  <span>{selectedRequest.durationMs ?? "—"}ms</span>

                  <span>{new Date(selectedRequest.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* REQUEST INSPECTOR */}

              <div className="min-h-0 flex-1 overflow-hidden">
                {detailsLoading && <div className="p-5 text-sm text-zinc-500">Loading request details...</div>}

                {requestDetails && !detailsLoading && (
                  <RequestInspector
                    request={requestDetails}
                    onClose={() => {
                      setSelectedRequest(null);
                      setRequestDetails(null);
                    }}
                  />
                )}
              </div>
            </>
          )}
        </section>

        {/* PAGINATION */}

        <footer className="flex h-12 shrink-0 items-center justify-between border-t border-zinc-800 px-5">
          <span className="text-xs text-zinc-600">
            Page {page} of {totalPages}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => current - 1)}
              className="
                rounded border border-zinc-800
                px-3 py-1.5
                text-xs text-zinc-400
                disabled:cursor-not-allowed
                disabled:opacity-30
                hover:bg-zinc-800
              "
            >
              ← Previous
            </button>

            <button
              disabled={page === totalPages}
              onClick={() => setPage((current) => current + 1)}
              className="
                rounded border border-zinc-800
                px-3 py-1.5
                text-xs text-zinc-400
                disabled:cursor-not-allowed
                disabled:opacity-30
                hover:bg-zinc-800
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
