"use client";

import type { RequestLog } from "@/types/request";
import { getMethodClass, getStatusClass } from "@/lib/ui";

type RequestTableProps = {
  requests: RequestLog[];
  selectedRequest: RequestLog | null;
  onSelectRequest: (request: RequestLog) => void;
};

export function RequestTable({ requests, selectedRequest, onSelectRequest }: RequestTableProps) {
  return (
    <section className="flex min-h-0 flex-1 flex-col border-b border-[#27272a]">
      <div className="grid shrink-0 grid-cols-[90px_minmax(0,1fr)_90px_90px] items-center border-b border-[#27272a] bg-[#131316] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">
        <span>Method</span>
        <span>Path</span>
        <span>Status</span>
        <span className="text-right">Time</span>
      </div>

      <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto">
        {requests.length === 0 ? (
          <div className="flex min-h-56 items-center justify-center px-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#27272a] bg-[#131316] text-[#71717a]">
                <span className="text-sm">⌁</span>
              </div>

              <p className="text-sm font-medium text-[#d4d4d8]">No requests captured</p>

              <p className="mt-1 text-xs text-[#71717a]">Requests sent to this project will appear here.</p>
            </div>
          </div>
        ) : (
          requests.map((request) => {
            const isSelected = selectedRequest?.id === request.id;

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => onSelectRequest(request)}
                className={`group grid w-full grid-cols-[90px_minmax(0,1fr)_90px_90px] items-center border-b border-[#1e1e22] px-5 py-3 text-left transition-colors ${
                  isSelected ? "bg-[#18181b]" : "bg-transparent hover:bg-[#131316]"
                }`}
              >
                <div className="flex items-center">
                  <span className={`font-mono text-[10px] font-semibold tracking-wide ${getMethodClass(request.method)}`}>
                    {request.method.toUpperCase()}
                  </span>
                </div>

                <div className="min-w-0 pr-4">
                  <span
                    className={`block truncate font-mono text-xs transition-colors ${
                      isSelected ? "text-[#fafafa]" : "text-[#d4d4d8] group-hover:text-[#fafafa]"
                    }`}
                  >
                    {request.path}
                  </span>
                </div>

                <div>
                  <span className={`font-mono text-[10px] font-medium ${getStatusClass(request.statusCode)}`}>
                    {request.statusCode ?? "—"}
                  </span>
                </div>

                <div className="text-right">
                  <span className="font-mono text-[10px] text-[#71717a] transition-colors group-hover:text-[#a1a1aa]">
                    {typeof request.durationMs === "number" ? `${request.durationMs}ms` : "—"}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
