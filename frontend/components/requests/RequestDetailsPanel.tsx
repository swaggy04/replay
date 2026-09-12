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
  if (!selectedRequest) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-40">
      {/* Overlay */}

      <div
        className="
          absolute
          inset-0
          bg-black/65
          backdrop-blur-[2px]
        "
        onClick={onClose}
      />

      {/* Inspector container */}

      <div
        className="
          absolute
          inset-0
          flex
          items-center
          justify-center
          p-5
        "
      >
        {detailsLoading && (
          <div
            className="
              flex
              h-40
              w-full
              max-w-md
              flex-col
              items-center
              justify-center
              rounded-xl
              border
              border-[#302b2d]
              bg-[#0c080a]
              shadow-[0_24px_80px_rgba(0,0,0,0.55)]
            "
          >
            <div
              className="
                mb-4
                h-5
                w-5
                animate-spin
                rounded-full
                border-2
                border-[#302b2d]
                border-t-[#d8d4d5]
              "
            />

            <p className="text-sm font-medium text-[#c9c5c6]">Loading request details</p>

            <p className="mt-1 text-xs text-[#716b6e]">Fetching captured request data...</p>
          </div>
        )}

        {requestDetails && !detailsLoading && <RequestInspector request={requestDetails} onClose={onClose} />}
      </div>
    </div>
  );
}
