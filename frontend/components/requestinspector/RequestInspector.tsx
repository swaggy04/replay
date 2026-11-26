"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

import type { ReplayExecution, ReplayResult, RequestDetails } from "@/types/request";

import { replayRequest } from "../requestsApi";

import { ReplayTab } from "./replaytab";
import { OverviewTab } from "./OverviewTab";
import { DetailTab, InspectorTabs } from "./InspectorTabs";

type RequestInspectorProps = {
  request: RequestDetails;
  onClose: () => void;
};

export default function RequestInspector({ request, onClose }: RequestInspectorProps) {
  const { getToken } = useAuth();

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [replaying, setReplaying] = useState(false);
  const [replayError, setReplayError] = useState<string | null>(null);

  const [replayHistory, setReplayHistory] = useState<ReplayExecution[]>(request.replays ?? []);

  const [selectedReplay, setSelectedReplay] = useState<ReplayExecution | null>(null);

  async function handleReplay() {
    setReplaying(true);
    setReplayError(null);

    try {
      const token = await getToken();

      if (!token) {
        throw new Error("Unable to obtain Clerk session token.");
      }

      const data: ReplayResult = await replayRequest(request.id, token);

      setReplayHistory((history) => [data.replay, ...history]);
      setSelectedReplay(data.replay);
      setActiveTab("replay");
    } catch (error) {
      console.error("Replay failed:", error);

      setReplayError(error instanceof Error ? error.message : "Failed to replay request");
    } finally {
      setReplaying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-[2px] sm:p-6">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-md border border-[#27272a] bg-[#131316] shadow-[0_24px_80px_rgba(0,0,0,0.6)]">
        {/* HEADER */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#27272a] bg-[#0e0e11] px-4 py-3.5 sm:px-5">
          {/* Request identity */}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-3">
              <MethodBadge method={request.method} />

              <div className="min-w-0">
                <div
                  className="
                    truncate
                    font-mono
                    text-sm
                    font-semibold
                    tracking-tight
                    text-[#fafafa]
                    sm:text-[15px]
                  "
                >
                  {request.path}
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div
              className="
                mt-2
                flex
                flex-wrap
                items-center
                gap-x-2.5
                gap-y-1
                text-[10px]
                sm:text-xs
              "
            >
              <StatusPill status={request.statusCode} />

              <span className="text-[#3f3f46]">•</span>

              <span className="font-mono text-[#a1a1aa]">
                {request.durationMs !== null ? `${request.durationMs}ms` : "—"}
              </span>

              <span className="text-[#3f3f46]">•</span>

              <span className="text-[#a1a1aa]">{new Date(request.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* HEADER ACTIONS */}
          <div className="ml-3 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              disabled={replaying}
              className="inline-flex h-8 items-center gap-2 rounded-md bg-[#fafafa] px-3 text-xs font-semibold text-[#09090b] transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {replaying && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#a1a1aa] border-t-[#09090b]" />
              )}

              {replaying ? "Replaying" : "Replay"}
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close request inspector"
              className="
                flex
                h-8
                w-8
                items-center
                justify-center
                rounded-md
                border
                border-transparent
                text-[#a1a1aa]
                transition
                hover:border-[#27272a]
                hover:bg-[#18181b]
                hover:text-[#fafafa]
              "
            >
              <span className="text-lg leading-none">×</span>
            </button>
          </div>
        </div>

        {/* TABS */}
        <div
          className="
            shrink-0
            border-b border-[#27272a]
            bg-[#0e0e11]
          "
        >
          <InspectorTabs activeTab={activeTab} onChange={setActiveTab} />
        </div>

        {/* CONTENT */}
        <div
          className="
            devreplay-scrollbar
            min-h-0
            flex-1
            overflow-y-auto
            bg-[#131316]
            px-4
            py-5
            sm:px-6
            sm:py-6
          "
        >
          <div className="mx-auto w-full max-w-5xl">
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
                requestId={request.id}
                method={request.method}
                path={request.path}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Detail Section                                                             */
/* -------------------------------------------------------------------------- */

export function DetailSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3
          className="
            text-[10px]
            font-semibold
            uppercase
            tracking-[0.12em]
            text-[#a1a1aa]
          "
        >
          {title}
        </h3>
      </div>

      {children}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Info Row                                                                   */
/* -------------------------------------------------------------------------- */

export function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      className="
        grid
        grid-cols-[100px_minmax(0,1fr)]
        items-center
        border-b border-[#27272a]
        px-4
        py-3
        last:border-b-0
        sm:grid-cols-[120px_minmax(0,1fr)]
      "
    >
      <span className="text-[10px] font-medium text-[#71717a]">{label}</span>

      <span className={mono ? "truncate font-mono text-xs text-[#f4f4f5]" : "truncate text-xs text-[#d4d4d8]"}>
        {value}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* JSON Block                                                                 */
/* -------------------------------------------------------------------------- */

export function JsonBlock({ data }: { data: unknown }) {
  const [copied, setCopied] = useState(false);

  const content = typeof data === "string" ? data : JSON.stringify(data ?? {}, null, 2);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }

  return (
    <div
      className="
        overflow-hidden
        rounded-lg
        border border-[#27272a]
        bg-[#131316]
        shadow-sm
      "
    >
      {/* CODE TOOLBAR */}
      <div
        className="
          flex
          h-9
          items-center
          justify-between
          border-b border-[#27272a]
          bg-[#131316]
          px-3
        "
      >
        <div className="flex items-center gap-2">
          <span
            className="
              font-mono
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-[#71717a]
            "
          >
            JSON
          </span>

          <span className="h-1 w-1 rounded-full bg-[#3f3f46]" />

          <span className="text-[9px] text-[#71717a]">Read only</span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="
            rounded
            px-2
            py-1
            text-[10px]
            font-medium
            text-[#a1a1aa]
            transition
            hover:bg-[#1c1c20]
            hover:text-[#fafafa]
          "
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      {/* CODE */}
      <pre
        className="
          devreplay-scrollbar
          max-h-[440px]
          overflow-auto
          p-4
          font-mono
          text-[10px]
          leading-6
          text-[#d4d4d8]
          sm:text-xs
        "
      >
        {content}
      </pre>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Method Badge                                                               */
/* -------------------------------------------------------------------------- */

function MethodBadge({ method }: { method: string }) {
  const normalizedMethod = method.toUpperCase();

  return (
    <span
      className="
        inline-flex h-7 shrink-0 items-center rounded border border-[#3f3f46] bg-[#27272a]
        px-2 font-mono text-[10px] font-semibold tracking-wide text-[#fafafa]
      "
    >
      {normalizedMethod}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export function StatusText({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="font-mono text-[#71717a]">—</span>;
  }

  let className = "font-mono font-medium text-[#a1a1aa]";

  if (status >= 200 && status < 300) {
    className = "font-mono font-semibold text-[#fafafa]";
  } else if (status >= 300 && status < 400) {
    className = "font-mono font-semibold text-[#d4d4d8]";
  } else if (status >= 400 && status < 500) {
    className = "font-mono font-semibold text-[#fca5a5]";
  } else if (status >= 500) {
    className = "font-mono font-semibold text-[#f87171]";
  }

  return <span className={className}>{status}</span>;
}

/* -------------------------------------------------------------------------- */
/* Status Pill                                                                */
/* -------------------------------------------------------------------------- */

function StatusPill({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="text-[#71717a]">—</span>;
  }

  let className = "border-[#3f3f46] bg-[#1f1f22] text-[#a1a1aa]";

  if (status >= 200 && status < 300) {
    className = "border-[#3f3f46] bg-[#27272a] text-[#fafafa]";
  } else if (status >= 300 && status < 400) {
    className = "border-[#3f3f46] bg-[#27272a] text-[#d4d4d8]";
  } else if (status >= 400 && status < 500) {
    className = "border-red-900/40 bg-red-950/20 text-[#fca5a5]";
  } else if (status >= 500) {
    className = "border-red-900/40 bg-red-950/20 text-[#f87171]";
  }

  return (
    <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${className}`}>
      {status}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Stat Card                                                                  */
/* -------------------------------------------------------------------------- */

export function StatCard({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div
      className="
        rounded-lg
        border border-[#27272a]
        bg-[#131316]
        px-4
        py-3
        transition-colors
        hover:border-[#353033]
      "
    >
      <div
        className="
          text-[9px]
          font-semibold
          uppercase
          tracking-[0.12em]
          text-[#71717a]
        "
      >
        {label}
      </div>

      <div
        className={mono ? "mt-1.5 truncate font-mono text-sm text-[#fafafa]" : "mt-1.5 truncate text-xs text-[#d5d1d2]"}
      >
        {value}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Empty State                                                                */
/* -------------------------------------------------------------------------- */

export function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="
        flex
        min-h-32
        items-center
        justify-center
        rounded-lg
        border border-dashed border-[#27272a]
        bg-[#131316]
        px-4
        py-8
        text-center
        text-xs
        text-[#817b7e]
      "
    >
      {message}
    </div>
  );
}
