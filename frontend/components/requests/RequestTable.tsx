"use client";

import type { RequestLog } from "@/types/request";

type RequestTableProps = {
  requests: RequestLog[];
  selectedRequest: RequestLog | null;
  onSelectRequest: (request: RequestLog) => void;
};

export function RequestTable({ requests, selectedRequest, onSelectRequest }: RequestTableProps) {
  function getStatusClass(status: number | null) {
    if (!status) {
      return "text-[#d1d1d3]";
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

    return "text-[#e2e2e4]";
  }

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
        return "text-[#e2e2e4]";
    }
  }

  return (
    <section className="border-b border-[#e1dbd6]/20">
      <div
        className="
          grid grid-cols-[80px_1fr_90px_90px]
          border-b border-[#e1dbd6]/20
          bg-neutral-900
          px-5 py-2
          text-[11px]
          uppercase
          tracking-wide
          text-[#d1d1d3]
        "
      >
        <span>Method</span>
        <span>Path</span>
        <span>Status</span>
        <span>Time</span>
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {requests.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-[#d1d1d3]">No requests captured yet.</div>
        ) : (
          requests.map((request) => (
            <button
              key={request.id}
              onClick={() => onSelectRequest(request)}
              className={`
                grid w-full
                grid-cols-[80px_1fr_90px_90px]
                items-center
                border-b border-[#e1dbd6]/15
                px-5 py-3
                text-left
                transition
                hover:bg-[#f9f6f2]/5
                ${selectedRequest?.id === request.id ? "bg-[#f9f6f2]/10" : ""}
              `}
            >
              <span className={`text-xs font-bold ${getMethodClass(request.method)}`}>{request.method}</span>

              <span className="truncate text-sm text-[#e2e2e4]">{request.path}</span>

              <span className={`text-xs font-medium ${getStatusClass(request.statusCode)}`}>
                {request.statusCode ?? "—"}
              </span>

              <span className="text-xs text-[#d1d1d3]">
                {typeof request.durationMs === "number" ? `${request.durationMs}ms` : "—"}
              </span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
