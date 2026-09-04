"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type { ReplayExecution, ReplayResult, RequestDetails } from "@/types/request";

type RequestInspectorProps = {
  request: RequestDetails;
  onClose: () => void;
};

type DetailTab = "overview" | "headers" | "query" | "body" | "response" | "replay";

export default function RequestInspector({ request, onClose }: RequestInspectorProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const [replaying, setReplaying] = useState(false);

  const [replayError, setReplayError] = useState<string | null>(null);

  const [replayHistory, setReplayHistory] = useState<ReplayExecution[]>(request.replays ?? []);

  const [selectedReplay, setSelectedReplay] = useState<ReplayExecution | null>(null);

  async function handleReplay() {
    setReplaying(true);
    setReplayError(null);

    try {
      const response = await fetch(`http://localhost:5000/replay/${request.id}`, {
        method: "POST",
      });

      const data: ReplayResult = await response.json();

      console.log("Replay response:", {
        httpStatus: response.status,
        data,
      });

      setReplayHistory((history) => [data.replay, ...history]);

      setSelectedReplay(data.replay);

      setActiveTab("replay");
    } catch (error) {
      console.error("Replay failed:", error);
      setReplayError("Failed to replay request");
    } finally {
      setReplaying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6">
      <div
        className="
          flex h-[85vh] w-full max-w-4xl
          flex-col overflow-hidden
          rounded-lg border border-[#e1dbd6]/20
          bg-[#0c080a]
          shadow-2xl
        "
      >
        {/* Header */}
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#2d292a] px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {/* HTTP Method */}
              <span className="rounded-md bg-green-500/10 px-2 py-1 font-mono text-xs font-bold text-green-400">
                {request.method}
              </span>

              {/* Request Path */}
              <span className="truncate font-mono text-sm font-medium text-[#fefefe]">{request.path}</span>
            </div>

            {/* Metadata */}
            <div className="mt-2 flex items-center gap-3 text-xs">
              <span
                className={
                  request.statusCode && request.statusCode >= 200 && request.statusCode < 300
                    ? "font-medium text-emerald-400"
                    : request.statusCode && request.statusCode >= 400
                      ? "font-medium text-red-400"
                      : "text-[#d1d1d3]"
                }
              >
                {request.statusCode ?? "—"}
              </span>

              <span className="text-[#3a3436]">•</span>

              <span className="text-[#d1d1d3]">{request.durationMs ?? "—"}ms</span>

              <span className="text-[#3a3436]">•</span>

              <span className="text-[#d1d1d3]">{new Date(request.createdAt).toLocaleString()}</span>
            </div>
          </div>

          <div className="ml-4 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              disabled={replaying}
              className="
        rounded-md
        border border-[#3a3436]
        bg-[#111011]
        px-3 py-1.5
        text-xs font-medium
        text-[#e2e2e4]
        transition
        hover:border-[#5a5154]
        hover:bg-[#171617]
        hover:text-[#fefefe]
        disabled:cursor-not-allowed
        disabled:opacity-50
      "
            >
              {replaying ? "Replaying..." : "Replay"}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="
        flex h-8 w-8 items-center justify-center
        rounded-md
        text-lg
        text-[#d1d1d3]
        transition
        hover:bg-[#171617]
        hover:text-[#fefefe]
      "
              aria-label="Close request inspector"
            >
              ×
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-[#e1dbd6]/20 px-4">
          {(
            [
              ["overview", "Overview"],
              ["headers", "Headers"],
              ["query", "Query"],
              ["body", "Body"],
              ["response", "Response"],
              ["replay", "Replay"],
            ] as [DetailTab, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`
                border-b-2 px-4 py-3 text-xs transition
                ${
                  activeTab === value
                    ? "border-[#f9f6f2] text-[#fefefe]"
                    : "border-transparent text-[#d1d1d3] hover:text-[#e2e2e4]"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
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

          {activeTab === "replay" && (
            <ReplayTab
              replayHistory={replayHistory}
              selectedReplay={selectedReplay}
              onSelectReplay={setSelectedReplay}
              replayError={replayError}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Overview                                                                   */
/* -------------------------------------------------------------------------- */

function OverviewTab({ request }: { request: RequestDetails }) {
  return (
    <div className="space-y-6">
      <DetailSection title="Request">
        <div className="rounded-md border border-[#e1dbd6]/20 bg-neutral-900">
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

/* -------------------------------------------------------------------------- */
/* Replay                                                                     */
/* -------------------------------------------------------------------------- */

function ReplayTab({
  replayHistory,
  selectedReplay,
  onSelectReplay,
  replayError,
}: {
  replayHistory: ReplayExecution[];
  selectedReplay: ReplayExecution | null;
  onSelectReplay: (replay: ReplayExecution) => void;
  replayError: string | null;
}) {
  return (
    <div className="space-y-6">
      {/* Replay History */}
      <DetailSection title="Replay History">
        {replayHistory.length === 0 ? (
          <div className="rounded-md border border-[#e1dbd6]/20 bg-neutral-900 p-4 text-sm text-[#d1d1d3]">
            No replay executions yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-md border border-[#e1dbd6]/20">
            {replayHistory.map((replay) => (
              <button
                key={replay.id}
                type="button"
                onClick={() => onSelectReplay(replay)}
                className={`
                  grid w-full
                  grid-cols-[1fr_100px_100px]
                  items-center
                  border-b border-[#e1dbd6]/15
                  px-4 py-3
                  text-left
                  transition
                  last:border-b-0
                  ${selectedReplay?.id === replay.id ? "bg-[#f9f6f2]/10" : "bg-neutral-900 hover:bg-[#f9f6f2]/5"}
                `}
              >
                <div>
                  <div className="text-xs text-[#e2e2e4]">{new Date(replay.createdAt).toLocaleString()}</div>

                  <div className="mt-1 truncate font-mono text-[11px] text-[#d1d1d3]/60">{replay.id}</div>
                </div>

                <div className="text-sm text-[#e2e2e4]">{replay.statusCode}</div>

                <div className="text-right font-mono text-xs text-[#d1d1d3]">{replay.durationMs}ms</div>
              </button>
            ))}
          </div>
        )}
      </DetailSection>

      {/* Replay Error */}
      {replayError && (
        <div className="rounded-md border border-red-400/20 bg-red-950/20 p-4 text-sm text-red-300">{replayError}</div>
      )}

      {/* Selected Replay */}
      {selectedReplay && (
        <DetailSection title="Selected Replay">
          <div className="mb-3 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-[#e1dbd6]/20 bg-neutral-900 p-3">
              <div className="text-xs text-[#d1d1d3]">Status</div>

              <div className="mt-1 font-mono text-sm text-[#fefefe]">{selectedReplay.statusCode}</div>
            </div>

            <div className="rounded-md border border-[#e1dbd6]/20 bg-neutral-900 p-3">
              <div className="text-xs text-[#d1d1d3]">Duration</div>

              <div className="mt-1 font-mono text-sm text-[#fefefe]">{selectedReplay.durationMs}ms</div>
            </div>

            <div className="rounded-md border border-[#e1dbd6]/20 bg-neutral-900 p-3">
              <div className="text-xs text-[#d1d1d3]">Executed</div>

              <div className="mt-1 text-xs text-[#e2e2e4]">{new Date(selectedReplay.createdAt).toLocaleString()}</div>
            </div>
          </div>

          <pre
            className="
              max-h-[400px]
              overflow-auto
              rounded-md
              border border-[#e1dbd6]/20
              bg-neutral-900
              p-4
              font-mono
              text-xs
              leading-6
              text-[#e2e2e4]
            "
          >
            {typeof selectedReplay.responseBody === "string"
              ? selectedReplay.responseBody
              : JSON.stringify(selectedReplay.responseBody ?? {}, null, 2)}
          </pre>
        </DetailSection>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#d1d1d3]">{title}</h3>

      {children}
    </section>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[120px_1fr] border-b border-[#e1dbd6]/15 px-4 py-3 last:border-b-0">
      <span className="text-xs text-[#d1d1d3]">{label}</span>

      <span className={mono ? "truncate font-mono text-xs text-[#e2e2e4]" : "text-sm text-[#e2e2e4]"}>{value}</span>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre
      className="
        overflow-x-auto
        rounded-md
        border border-[#e1dbd6]/20
        bg-neutral-900
        p-4
        font-mono
        text-xs
        leading-6
        text-[#e2e2e4]
      "
    >
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}
