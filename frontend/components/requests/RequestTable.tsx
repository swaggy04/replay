"use client";

import type { RequestLog } from "@/types/request";

type RequestTableProps = {
  requests: RequestLog[];
  selectedRequest: RequestLog | null;
  onSelectRequest: (request: RequestLog) => void;
};

export function RequestTable({ requests, selectedRequest, onSelectRequest }: RequestTableProps) {
  function getMethodClass(method: string) {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-emerald-400";

      case "POST":
        return "text-[#F4D77E]";

      case "PUT":
        return "text-blue-400";

      case "PATCH":
        return "text-purple-400";

      case "DELETE":
        return "text-red-400";

      case "HEAD":
        return "text-emerald-300";

      case "OPTIONS":
        return "text-pink-400";

      default:
        return "text-[#d8d4d5]";
    }
  }

  function getStatusClass(status: number | null) {
    if (status === null) {
      return "text-[#777174]";
    }

    if (status >= 200 && status < 300) {
      return "text-emerald-400";
    }

    if (status >= 300 && status < 400) {
      return "text-amber-400";
    }

    if (status >= 400 && status < 500) {
      return "text-orange-400";
    }

    if (status >= 500) {
      return "text-red-400";
    }

    return "text-[#d8d4d5]";
  }

  return (
    <section className="min-h-0 flex-1 border-b border-[#242022]">
      {/* TABLE HEADER */}

      <div
        className="
          grid
          grid-cols-[90px_minmax(0,1fr)_90px_90px]
          items-center
          border-b border-[#242022]
          bg-[#100d0f]
          px-5
          py-2.5
          text-[9px]
          font-semibold
          uppercase
          tracking-[0.12em]
          text-[#716b6e]
        "
      >
        <span>Method</span>
        <span>Path</span>
        <span>Status</span>
        <span className="text-right">Time</span>
      </div>

      {/* TABLE BODY */}

      <div className="devreplay-scrollbar max-h-[420px] overflow-y-auto">
        {requests.length === 0 ? (
          <div
            className="
              flex
              min-h-56
              items-center
              justify-center
              px-5
              text-center
            "
          >
            <div>
              <div
                className="
                  mx-auto
                  mb-3
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border border-[#292426]
                  bg-[#131012]
                  text-[#716b6e]
                "
              >
                <span className="text-sm">⌁</span>
              </div>

              <p className="text-sm font-medium text-[#c9c5c6]">No requests captured</p>

              <p className="mt-1 text-xs text-[#716b6e]">Requests sent to this project will appear here.</p>
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
                className={`
                  group
                  grid
                  w-full
                  grid-cols-[90px_minmax(0,1fr)_90px_90px]
                  items-center
                  border-b border-[#211e20]
                  px-5
                  py-3
                  text-left
                  transition-colors
                  ${isSelected ? "bg-[#191517]" : "bg-transparent hover:bg-[#141012]"}
                `}
              >
                {/* METHOD */}

                <div className="flex items-center">
                  <span
                    className={`
                      font-mono
                      text-[11px]
                      font-semibold
                      tracking-wide
                      ${getMethodClass(request.method)}
                    `}
                  >
                    {request.method.toUpperCase()}
                  </span>
                </div>

                {/* PATH */}

                <div className="min-w-0 pr-4">
                  <span
                    className={`
                      block
                      truncate
                      font-mono
                      text-xs
                      transition-colors
                      ${isSelected ? "text-[#f1eeee]" : "text-[#c2bdc0] group-hover:text-[#e5e1e2]"}
                    `}
                  >
                    {request.path}
                  </span>
                </div>

                {/* STATUS */}

                <div>
                  <span
                    className={`
                      font-mono
                      text-[11px]
                      font-medium
                      ${getStatusClass(request.statusCode)}
                    `}
                  >
                    {request.statusCode ?? "—"}
                  </span>
                </div>

                {/* DURATION */}

                <div className="text-right">
                  <span
                    className="
                      font-mono
                      text-[11px]
                      text-[#777174]
                      transition-colors
                      group-hover:text-[#a49ea1]
                    "
                  >
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
