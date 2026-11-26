import type { RequestDetails } from "@/types/request";

import { DetailSection, InfoRow, JsonBlock, StatusText } from "./RequestInspector";

export function OverviewTab({ request }: { request: RequestDetails }) {
  return (
    <div className="space-y-8">
      {/* REQUEST METADATA */}

      <DetailSection title="Request">
        <div
          className="
            overflow-hidden
            rounded-lg
            border border-[#27272a]
            bg-[#131316]
          "
        >
          <InfoRow label="Request ID" value={request.id} mono />

          <InfoRow label="Method" value={request.method} />

          <InfoRow label="Path" value={request.path} mono />

          <div
            className="
              grid
              grid-cols-[100px_minmax(0,1fr)]
              items-center
              border-b border-[#27272a]
              px-4
              py-3
              sm:grid-cols-[120px_minmax(0,1fr)]
            "
          >
            <span
              className="
                text-[11px]
                font-medium
                text-[#71717a]
              "
            >
              Status
            </span>

            <StatusText status={request.statusCode} />
          </div>

          <InfoRow label="Duration" value={request.durationMs !== null ? `${request.durationMs}ms` : "—"} mono />

          <InfoRow label="Created" value={new Date(request.createdAt).toLocaleString()} />
        </div>
      </DetailSection>

      {/* QUERY */}

      <DetailSection title="Query Parameters">
        <JsonBlock data={request.query} />
      </DetailSection>

      {/* BODY */}

      <DetailSection title="Request Body">
        <JsonBlock data={request.body} />
      </DetailSection>

      {/* RESPONSE */}

      <DetailSection title="Response Body">
        <JsonBlock data={request.responseBody} />
      </DetailSection>
    </div>
  );
}
