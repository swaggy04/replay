"use client";

import type { ReplayResult, RequestDetails } from "@/types/request";
import { useState } from "react";

type RequestInspectorProps = {
  request: RequestDetails;
  onClose: () => void;
};

type DetailTab = "overview" | "headers" | "query" | "body" | "response";

export default function RequestInspector({ request, onClose }: RequestInspectorProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  async function handleReplay() {
    setReplaying(true);
    setReplayResult(null);
    setReplayError(null);

    try {
      const response = await fetch(
        `http://localhost:5000/replay/${request.id}`,

        {
          method: "POST",
        },
      );
      if (!response.ok) {
        throw new Error("Replay failed");
      }

      const data: ReplayResult = await response.json();

      setReplayResult(data);
    } catch (error) {
      console.error("Replay failed:", error);
      setReplayError("Failed to replay request");
    } finally {
      setReplaying(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      {/* Popover */}
      <div
        className="
          flex h-[85vh] w-full max-w-4xl
          flex-col overflow-hidden
          rounded-lg border border-zinc-800
          bg-[#111318]
          shadow-2xl
        "
      >
        {/* Header */}

        <div className="flex shrink-0 items-start justify-between border-b border-zinc-800 px-6 py-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-blue-400">{request.method}</span>

              <span className="font-mono text-sm text-zinc-300">{request.path}</span>
            </div>

            <div className="mt-2 flex gap-4 text-xs text-zinc-500">
              <span>Status: {request.statusCode ?? "—"}</span>

              <span>Duration: {request.durationMs ?? "—"}ms</span>

              <span>{new Date(request.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="
      rounded-md border border-zinc-700
      px-3 py-1.5
      text-xs font-medium text-zinc-300
      hover:bg-zinc-800 hover:text-white
    "
            >
              Replay
            </button>

            <button
              onClick={onClose}
              className="
      flex h-8 w-8 items-center justify-center
      rounded-md
      text-zinc-500
      hover:bg-zinc-800
      hover:text-white
    "
              aria-label="Close request inspector"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}

        <div className="flex shrink-0 border-b border-zinc-800 px-4">
          {(
            [
              ["overview", "Overview"],
              ["headers", "Headers"],
              ["query", "Query"],
              ["body", "Body"],
              ["response", "Response"],
            ] as [DetailTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`
                border-b-2 px-4 py-3 text-xs transition
                ${
                  activeTab === value
                    ? "border-white text-white"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {activeTab === "overview" && <OverviewTab request={request} />}

          {activeTab === "headers" && (
            <DetailSection title="Request Headers">
              <JsonBlock data={request.headers} />
            </DetailSection>
          )}

          {activeTab === "query" && (
            <DetailSection title="Query Parameters">
              <JsonBlock data={request.query} />
            </DetailSection>
          )}

          {activeTab === "body" && (
            <DetailSection title="Request Body">
              <JsonBlock data={request.body} />
            </DetailSection>
          )}

          {activeTab === "response" && (
            <DetailSection title="Response Body">
              <JsonBlock data={request.responseBody} />
            </DetailSection>
          )}
        </div>
      </div>
    </div>
  );
}
function OverviewTab({ request }: { request: RequestDetails }) {
  return (
    <div className="space-y-6">
      <DetailSection title="Request">
        <div className="rounded-md border border-zinc-800 bg-[#0b0d10]">
          <InfoRow label="Request ID" value={request.id} mono />

          <InfoRow label="Method" value={request.method} />

          <InfoRow label="Path" value={request.path} mono />

          <InfoRow label="Status" value={String(request.statusCode ?? "—")} />

          <InfoRow label="Duration" value={request.durationMs !== null ? `${request.durationMs}ms` : "—"} />

          <InfoRow label="Created" value={new Date(request.createdAt).toLocaleString()} />
        </div>
      </DetailSection>

      <DetailSection title="Query Parameters">
        <JsonBlock data={request.query} />
      </DetailSection>

      <DetailSection title="Request Body">
        <JsonBlock data={request.body} />
      </DetailSection>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>

      {children}
    </section>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] border-b border-zinc-800/70 px-4 py-3 last:border-b-0">
      <span className="text-xs text-zinc-600">{label}</span>

      <span className={mono ? "truncate font-mono text-xs text-zinc-300" : "text-sm text-zinc-300"}>{value}</span>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre
      className="
        overflow-x-auto
        rounded-md
        border border-zinc-800
        bg-[#0b0d10]
        p-4
        font-mono
        text-xs
        leading-6
        text-zinc-300
      "
    >
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}
