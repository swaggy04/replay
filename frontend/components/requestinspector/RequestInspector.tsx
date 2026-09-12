"use client";

import type { ReactNode } from "react";
import { useState } from "react";

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
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const [replaying, setReplaying] = useState(false);

  const [replayError, setReplayError] = useState<string | null>(null);

  const [replayHistory, setReplayHistory] = useState<ReplayExecution[]>(request.replays ?? []);

  const [selectedReplay, setSelectedReplay] = useState<ReplayExecution | null>(null);

  async function handleReplay() {
    setReplaying(true);
    setReplayError(null);

    try {
      const data: ReplayResult = await replayRequest(request.id);

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
    <div
      className="
        fixed inset-0 z-50
        flex items-center justify-center
        bg-black/65
        p-3
        backdrop-blur-[2px]
        sm:p-6
      "
    >
      <div
        className="
          flex
          h-[92vh]
          w-full
          max-w-6xl
          flex-col
          overflow-hidden
          rounded-xl
          border border-[#302b2d]
          bg-[#0c080a]
          shadow-[0_24px_80px_rgba(0,0,0,0.55)]
        "
      >
        {/* HEADER */}

        <div
          className="
            flex
            shrink-0
            items-center
            justify-between
            border-b border-[#2d292a]
            bg-[#0f0b0d]
            px-4
            py-3.5
            sm:px-5
          "
        >
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
                    text-[#f7f5f5]
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
                text-[11px]
                sm:text-xs
              "
            >
              <StatusPill status={request.statusCode} />

              <span className="text-[#403a3d]">•</span>

              <span
                className="
                  font-mono
                  text-[#b7b2b5]
                "
              >
                {request.durationMs !== null ? `${request.durationMs}ms` : "—"}
              </span>

              <span className="text-[#403a3d]">•</span>

              <span className="text-[#8f898c]">{new Date(request.createdAt).toLocaleString()}</span>
            </div>
          </div>

          {/* HEADER ACTIONS */}

          <div className="ml-3 flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              disabled={replaying}
              className="
                inline-flex
                h-8
                items-center
                gap-2
                rounded-md
                border border-[#403a3d]
                bg-[#171315]
                px-3
                text-xs
                font-semibold
                text-[#e8e5e6]
                shadow-sm
                transition
                hover:border-[#5a5255]
                hover:bg-[#211c1e]
                hover:text-white
                active:scale-[0.98]
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {replaying && (
                <span
                  className="
                    h-3
                    w-3
                    animate-spin
                    rounded-full
                    border-2
                    border-[#777174]
                    border-t-[#f5f3f3]
                  "
                />
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
                text-[#8f898c]
                transition
                hover:border-[#302b2d]
                hover:bg-[#171315]
                hover:text-[#f5f3f3]
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
            border-b border-[#2d292a]
            bg-[#0d090b]
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
            bg-[#0c080a]
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
            text-[#918b8e]
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
        border-b border-[#242022]
        px-4
        py-3
        last:border-b-0
        sm:grid-cols-[120px_minmax(0,1fr)]
      "
    >
      <span
        className="
          text-[11px]
          font-medium
          text-[#777174]
        "
      >
        {label}
      </span>

      <span
        className={
          mono
            ? `
              truncate
              font-mono
              text-xs
              text-[#e5e1e2]
            `
            : `
              truncate
              text-xs
              text-[#d7d3d4]
            `
        }
      >
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

      setTimeout(() => {
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
        border border-[#292426]
        bg-[#100d0f]
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
          border-b border-[#242022]
          bg-[#131012]
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
              text-[#716b6e]
            "
          >
            JSON
          </span>

          <span className="h-1 w-1 rounded-full bg-[#393335]" />

          <span
            className="
              text-[9px]
              text-[#5e585b]
            "
          >
            Read only
          </span>
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
            text-[#9c9699]
            transition
            hover:bg-[#1b1719]
            hover:text-[#f0edee]
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
          text-[11px]
          leading-6
          text-[#d9d5d6]
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

  const styles: Record<string, string> = {
    GET: `
      border-emerald-500/20
      bg-emerald-500/10
      text-emerald-400
    `,
    POST: `
      border-blue-500/20
      bg-blue-500/10
      text-blue-400
    `,
    PUT: `
      border-amber-500/20
      bg-amber-500/10
      text-amber-400
    `,
    PATCH: `
      border-orange-500/20
      bg-orange-500/10
      text-orange-400
    `,
    DELETE: `
      border-red-500/20
      bg-red-500/10
      text-red-400
    `,
  };

  return (
    <span
      className={`
        inline-flex
        h-7
        shrink-0
        items-center
        rounded-md
        border
        px-2
        font-mono
        text-[10px]
        font-bold
        tracking-wide
        ${
          styles[normalizedMethod] ??
          `
          border-[#393335]
          bg-[#171315]
          text-[#d8d4d5]
        `
        }
      `}
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
    return <span className="font-medium text-[#8d878a]">—</span>;
  }

  let className = "font-medium text-[#b7b2b5]";

  if (status >= 200 && status < 300) {
    className = "font-semibold text-emerald-400";
  } else if (status >= 300 && status < 400) {
    className = "font-semibold text-amber-400";
  } else if (status >= 400 && status < 500) {
    className = "font-semibold text-orange-400";
  } else if (status >= 500) {
    className = "font-semibold text-red-400";
  }

  return <span className={className}>{status}</span>;
}

/* -------------------------------------------------------------------------- */
/* Status Pill                                                                */
/* -------------------------------------------------------------------------- */

function StatusPill({ status }: { status: number | null }) {
  if (status === null) {
    return <span className="text-[#777174]">—</span>;
  }

  let className = "border-[#393335] bg-[#171315] text-[#b7b2b5]";

  if (status >= 200 && status < 300) {
    className = "border-emerald-500/15 bg-emerald-500/8 text-emerald-400";
  } else if (status >= 300 && status < 400) {
    className = "border-amber-500/15 bg-amber-500/8 text-amber-400";
  } else if (status >= 400 && status < 500) {
    className = "border-orange-500/15 bg-orange-500/8 text-orange-400";
  } else if (status >= 500) {
    className = "border-red-500/15 bg-red-500/8 text-red-400";
  }

  return (
    <span
      className={`
        rounded
        border
        px-1.5
        py-0.5
        font-mono
        text-[10px]
        font-semibold
        ${className}
      `}
    >
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
        border border-[#292426]
        bg-[#100d0f]
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
          text-[#716b6e]
        "
      >
        {label}
      </div>

      <div
        className={
          mono
            ? `
              mt-1.5
              truncate
              font-mono
              text-sm
              text-[#f0edee]
            `
            : `
              mt-1.5
              truncate
              text-xs
              text-[#d5d1d2]
            `
        }
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
        border border-dashed border-[#292426]
        bg-[#100d0f]
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
