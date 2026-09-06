import { RequestSidebarProps } from "@/types/request";
import React from "react";
export function getMethodClass(method: string) {
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
export function RequestSidebar({ requests, selectedRequests, onSelectRequest }: RequestSidebarProps) {
  return (
    <aside className="w-[250px] shrink-0 border-r border-[#e1dbd6]/20 bg-neutral-900">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-[#e1dbd6]/20 px-5">
        <div className="text-lg font-semibold text-[#fefefe]">DevReplay</div>
      </div>

      {/* Navigation */}
      <div className="p-3">
        <button
          className="
              mb-1 flex w-full items-center gap-3 rounded-md
              bg-[#f9f6f2]/10
              px-3 py-2.5
              text-sm text-[#fefefe]
            "
        >
          <span>▣</span>
          Requests
        </button>

        <button
          className="
              mb-1 flex w-full items-center gap-3 rounded-md
              px-3 py-2.5
              text-sm text-[#d1d1d3]
              transition
              hover:bg-[#f9f6f2]/5
              hover:text-[#fefefe]
            "
        >
          <span>↻</span>
          Replays
        </button>

        <button
          className="
              mb-1 flex w-full items-center gap-3 rounded-md
              px-3 py-2.5
              text-sm text-[#d1d1d3]
              transition
              hover:bg-[#f9f6f2]/5
              hover:text-[#fefefe]
            "
        >
          <span>▱</span>
          Collections
        </button>

        <button
          className="
              flex w-full items-center gap-3 rounded-md
              px-3 py-2.5
              text-sm text-[#d1d1d3]
              transition
              hover:bg-[#f9f6f2]/5
              hover:text-[#fefefe]
            "
        >
          <span>⚙</span>
          Settings
        </button>
      </div>

      {/* Recent requests */}
      <div className="mt-5">
        <div className="px-5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#d1d1d3]/60">Recent</div>

        {requests.slice(0, 8).map((request) => (
          <button
            key={request.id}
            onClick={() => onSelectRequest(request)}
            className={`
                flex w-full items-center gap-2
                px-5 py-2
                text-left
                transition
                hover:bg-[#f9f6f2]/5
                ${selectedRequests?.id === request.id ? "bg-[#f9f6f2]/10" : ""}
              `}
          >
            <span className={`w-12 text-[11px] font-semibold ${getMethodClass(request.method)}`}>{request.method}</span>

            <span className="truncate text-xs text-[#d1d1d3]">{request.path}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
