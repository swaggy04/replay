"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import type {
  ReplayExecution,
  ReplayResult,
  RequestDetails,
} from "@/types/request";

type RequestInspectorProps = {
  request: RequestDetails;
  onClose: () => void;
};

type DetailTab =
  | "overview"
  | "headers"
  | "query"
  | "body"
  | "response"
  | "replay";

export default function RequestInspector({
  request,
  onClose,
}: RequestInspectorProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const [replayHistory, setReplayHistory] = useState<ReplayExecution[]>(
    request.replays ?? [],
  );

  const [selectedReplay, setSelectedReplay] =
    useState<ReplayExecution | null>(null);

  async function handleReplay() {
    setReplaying(true);
    setReplayError(null);

    try {
      const response = await fetch(
        `http://localhost:5000/replay/${request.id}`,
        {
          method: "POST",
        },
      );

      const data: ReplayResult = await response.json();

      if (!response.ok) {
        throw new Error("Replay request failed");
      }

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

  const tabs: [DetailTab, string][] = [
    ["overview", "Overview"],
    ["headers", "Headers"],
    ["query", "Query"],
    ["body", "Body"],
    ["response", "Response"],
    ["replay", "Replay"],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 sm:p-6">
      <div
        className="
          flex h-[90vh] w-full max-w-5xl
          flex-col overflow-hidden
          rounded-lg
          border border-[#2d292a]
          bg-[#0c080a]
          shadow-2xl
        "
      >
        {/* ------------------------------------------------------------------ */}
        {/* Header                                                             */}
        {/* ------------------------------------------------------------------ */}

        <div className="flex shrink-0 items-center justify-between border-b border-[#2d292a] px-5 py-4">
          <div className="min-w-0">
            {/* Request identity */}
            <div className="flex min-w-0 items-center gap-3">
              <MethodBadge method={request.method} />

              <div className="min-w-0">
                <div className="truncate font-mono text-sm font-medium text-[#fefefe]">
                  {request.path}
                </div>
              </div>
            </div>

            {/* Request metadata */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <StatusText status={request.statusCode} />

              <span className="text-[#3a3436]">•</span>

              <span className="font-mono text-[#d1d1d3]">
                {request.durationMs !== null
                  ? `${request.durationMs}ms`
                  : "—"}
              </span>

              <span className="text-[#3a3436]">•</span>

              <span className="text-[#d1d1d3]">
                {new Date(request.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Header actions */}
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
                transition-colors
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
              aria-label="Close request inspector"
              className="
                flex h-8 w-8 items-center justify-center
                rounded-md
                text-lg
                text-[#d1d1d3]
                transition-colors
                hover:bg-[#171617]
                hover:text-[#fefefe]
              "
            >
              ×
            </button>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Tabs                                                               */}
        {/* ------------------------------------------------------------------ */}

        <div className="flex shrink-0 overflow-x-auto border-b border-[#2d292a] px-3">
          {tabs.map(([value, label]) => {
            const isActive = activeTab === value;

            return (
              <button
                key={value}
                type="button"
                onClick={() => setActiveTab(value)}
                className={`
                  relative shrink-0
                  px-4 py-3
                  text-xs font-medium
                  transition-colors
                  ${
                    isActive
                      ? "text-[#fefefe]"
                      : "text-[#d1d1d3] hover:text-[#e2e2e4]"
                  }
                `}
              >
                {label}

                {isActive && (
                  <span
                    className="
                      absolute inset-x-2 bottom-0
                      h-0.5
                      rounded-full
                      bg-[#fefefe]
                    "
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Content                                                            */}
        {/* ------------------------------------------------------------------ */}

        <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
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
    <div className="space-y-7">
      {/* Request metadata */}
      <DetailSection title="Request">
        <div className="overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
          <InfoRow label="Request ID" value={request.id} mono />

          <InfoRow label="Method" value={request.method} />

          <InfoRow label="Path" value={request.path} mono />

          <InfoRow
            label="Status"
            value={String(request.statusCode ?? "—")}
          />

          <InfoRow
            label="Duration"
            value={
              request.durationMs !== null
                ? `${request.durationMs}ms`
                : "—"
            }
          />

          <InfoRow
            label="Created"
            value={new Date(request.createdAt).toLocaleString()}
          />
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
    <div className="space-y-7">
      {/* Replay History */}
      <DetailSection title="Replay History">
        {replayHistory.length === 0 ? (
          <EmptyState message="No replay executions yet." />
        ) : (
          <div className="overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
            {replayHistory.map((replay) => {
              const isSelected = selectedReplay?.id === replay.id;

              return (
                <button
                  key={replay.id}
                  type="button"
                  onClick={() => onSelectReplay(replay)}
                  className={`
                    grid w-full
                    grid-cols-[minmax(0,1fr)_70px_80px]
                    items-center
                    gap-4
                    border-b border-[#211e1f]
                    px-4 py-3
                    text-left
                    transition-colors
                    last:border-b-0
                    ${
                      isSelected
                        ? "bg-[#171617]"
                        : "bg-[#111011] hover:bg-[#171617]"
                    }
                  `}
                >
                  {/* Replay identity */}
                  <div className="min-w-0">
                    <div className="truncate text-xs text-[#e2e2e4]">
                      {new Date(replay.createdAt).toLocaleString()}
                    </div>

                    <div className="mt-1 truncate font-mono text-[10px] text-[#d1d1d3]/60">
                      {replay.id}
                    </div>
                  </div>

                  {/* Status */}
                  <StatusText status={replay.statusCode} />

                  {/* Duration */}
                  <div className="text-right font-mono text-[11px] text-[#d1d1d3]">
                    {replay.durationMs}ms
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DetailSection>

      {/* Replay error */}
      {replayError && (
        <div
          className="
            rounded-md
            border border-red-500/20
            bg-red-950/20
            px-4 py-3
            text-xs
            text-red-300
          "
        >
          {replayError}
        </div>
      )}

      {/* Selected replay */}
      {selectedReplay && (
        <DetailSection title="Selected Replay">
          {/* Replay stats */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              label="Status"
              value={String(selectedReplay.statusCode)}
              mono
            />

            <StatCard
              label="Duration"
              value={`${selectedReplay.durationMs}ms`}
              mono
            />

            <StatCard
              label="Executed"
              value={new Date(
                selectedReplay.createdAt,
              ).toLocaleString()}
            />
          </div>

          {/* Replay response */}
          <JsonBlock data={selectedReplay.responseBody} />
        </DetailSection>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared UI                                                                  */
/* -------------------------------------------------------------------------- */

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section>
      <h3
        className="
          mb-2
          text-[11px]
          font-semibold
          uppercase
          tracking-[0.08em]
          text-[#d1d1d3]
        "
      >
        {title}
      </h3>

      {children}
    </section>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="
        grid
        grid-cols-[110px_minmax(0,1fr)]
        items-center
        border-b
        border-[#2d292a]
        px-4 py-3
        last:border-b-0
      "
    >
      <span className="text-xs font-medium text-[#d1d1d3]">
        {label}
      </span>

      <span
        className={
          mono
            ? "truncate font-mono text-xs text-[#e2e2e4]"
            : "truncate text-sm text-[#e2e2e4]"
        }
      >
        {value}
      </span>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);

  const content =
    typeof data === "string"
      ? data
      : JSON.stringify(data ?? {}, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
      {/* Code toolbar */}
      <div
        className="
          flex
          items-center
          justify-between
          border-b
          border-[#211e1f]
          px-3 py-2
        "
      >
        <span className="font-mono text-[10px] uppercase tracking-wide text-[#d1d1d3]/60">
          JSON
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className="
            rounded
            px-2 py-1
            text-[10px]
            font-medium
            text-[#d1d1d3]
            transition-colors
            hover:bg-[#171617]
            hover:text-[#fefefe]
          "
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <pre
        className="
          devreplay-scrollbar
          max-h-[420px]
          overflow-auto
          p-4
          font-mono
          text-xs
          leading-6
          text-[#e2e2e4]
        "
      >
        {content}
      </pre>
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  const normalizedMethod = method.toUpperCase();

  const styles: Record<string, string> = {
    GET: "bg-emerald-500/10 text-emerald-400",
    POST: "bg-blue-500/10 text-blue-400",
    PUT: "bg-amber-500/10 text-amber-400",
    PATCH: "bg-orange-500/10 text-orange-400",
    DELETE: "bg-red-500/10 text-red-400",
  };

  return (
    <span
      className={`
        rounded-md
        px-2 py-1
        font-mono
        text-[11px]
        font-bold
        ${styles[normalizedMethod] ?? "bg-[#171617] text-[#e2e2e4]"}
      `}
    >
      {normalizedMethod}
    </span>
  );
}

function StatusText({ status }: { status: number | null }) {
  if (status === null) {
    return (
      <span className="font-medium text-[#d1d1d3]">
        —
      </span>
    );
  }

  let className = "font-medium text-[#d1d1d3]";

  if (status >= 200 && status < 300) {
    className = "font-medium text-emerald-400";
  } else if (status >= 300 && status < 400) {
    className = "font-medium text-amber-400";
  } else if (status >= 400 && status < 500) {
    className = "font-medium text-orange-400";
  } else if (status >= 500) {
    className = "font-medium text-red-400";
  }

  return <span className={className}>{status}</span>;
}

function StatCard({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="
        rounded-md
        border border-[#2d292a]
        bg-[#111011]
        px-4 py-3
      "
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-[#d1d1d3]">
        {label}
      </div>

      <div
        className={
          mono
            ? "mt-1 truncate font-mono text-sm text-[#fefefe]"
            : "mt-1 truncate text-xs text-[#e2e2e4]"
        }
      >
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="
        rounded-md
        border border-dashed border-[#2d292a]
        bg-[#111011]
        px-4 py-8
        text-center
        text-xs
        text-[#d1d1d3]
      "
    >
      {message}
    </div>
  );
}