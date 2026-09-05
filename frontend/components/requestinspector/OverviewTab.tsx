import { RequestDetails } from "@/types/request";
import { DetailSection, InfoRow, JsonBlock } from "./RequestInspector";

export function OverviewTab({ request }: { request: RequestDetails }) {
  return (
    <div className="space-y-7">
      {/* Request metadata */}
      <DetailSection title="Request">
        <div className="overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
          <InfoRow label="Request ID" value={request.id} mono />

          <InfoRow label="Method" value={request.method} />

          <InfoRow label="Path" value={request.path} mono />

          <InfoRow label="Status" value={String(request.statusCode ?? "—")} />

          <InfoRow label="Duration" value={request.durationMs !== null ? `${request.durationMs}ms` : "—"} />

          <InfoRow label="Created" value={new Date(request.createdAt).toLocaleString()} />
        </div>
      </DetailSection>

      {/* Query */}
      <DetailSection title="Query Parameters">
        <JsonBlock data={request.query} />
      </DetailSection>

      {/* Body */}
      <DetailSection title="Request Body">
        <JsonBlock data={request.body} />
      </DetailSection>

      {/* Response */}
      <DetailSection title="Response Body">
        <JsonBlock data={request.responseBody} />
      </DetailSection>
    </div>
  );
}
