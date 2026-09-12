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

  /*
   * RequestInspector owns the modal/overlay.
   * This component only decides whether to show
   * the loading state or the inspector.
   */

  if (detailsLoading) {
    return (
      <div
        className="
          fixed
          inset-0
          z-50
          flex
          items-center
          justify-center
          bg-black/65
          p-5
          backdrop-blur-[2px]
        "
      >
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

          <p
            className="
              text-sm
              font-medium
              text-[#c9c5c6]
            "
          >
            Loading request details
          </p>

          <p
            className="
              mt-1
              text-xs
              text-[#716b6e]
            "
          >
            Fetching captured request data...
          </p>
        </div>
      </div>
    );
  }

  if (!requestDetails) {
    return null;
  }

  return <RequestInspector request={requestDetails} onClose={onClose} />;
}
