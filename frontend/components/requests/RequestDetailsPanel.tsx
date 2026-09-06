"use client";

import RequestInspector from "../requestinspector/RequestInspector";
import type { RequestDetails, RequestLog } from "@/types/request";

type RequestDetailsPanelProps = {
  selectedRequest: RequestLog | null;
  requestDetails: RequestDetails | null;
  detailsLoading: boolean;
  onClose: () => void;
};

export function RequestDetailsPanel({
  selectedRequest,
  requestDetails,
  detailsLoading,
  onClose,
}: RequestDetailsPanelProps) {
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

  if (!selectedRequest) {
    return (
      <section className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mb-3 text-3xl text-[#d1d1d3]/30">◇</div>

            <h2 className="text-sm font-medium text-[#e2e2e4]">Select a request</h2>

            <p className="mt-1 text-xs text-[#d1d1d3]/60">Choose a captured request to inspect it.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      {/* REQUEST TITLE */}

      <div className="border-b border-[#e1dbd6]/20 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold ${getMethodClass(selectedRequest.method)}`}>
            {selectedRequest.method}
          </span>

          <span className="text-sm text-[#e2e2e4]">{selectedRequest.path}</span>
        </div>

        <div className="mt-2 flex gap-4 text-xs text-[#d1d1d3]">
          <span className={getStatusClass(selectedRequest.statusCode)}>{selectedRequest.statusCode ?? "Unknown"}</span>

          <span>{selectedRequest.durationMs ?? "—"}ms</span>

          <span>{new Date(selectedRequest.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* REQUEST INSPECTOR */}

      <div className="min-h-0 flex-1 overflow-hidden">
        {detailsLoading && <div className="p-5 text-sm text-[#d1d1d3]">Loading request details...</div>}

        {requestDetails && !detailsLoading && <RequestInspector request={requestDetails} onClose={onClose} />}
      </div>
    </section>
  );
}
