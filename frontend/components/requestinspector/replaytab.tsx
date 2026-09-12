"use client";

import { useState } from "react";

import type { ReplayComparison, ReplayExecution } from "@/types/request";

import { DetailSection, EmptyState, JsonBlock, StatCard, StatusText } from "./RequestInspector";

import { requestComparison } from "../requestsApi";
import { RequestComparison } from "./RequestCompariosn";

export function ReplayTab({
  replayHistory,
  selectedReplay,
  onSelectReplay,
  replayError,
  requestId,
  method,
  path,
}: {
  replayHistory: ReplayExecution[];
  selectedReplay: ReplayExecution | null;
  onSelectReplay: (replay: ReplayExecution) => void;
  replayError: string | null;
  requestId: string;
  method: string;
  path: string;
}) {
  const [comparison, setComparison] = useState<ReplayComparison | null>(null);

  const [comparisonLoading, setComparisonLoading] = useState(false);

  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const handleCompare = async (replay: ReplayExecution) => {
    try {
      setComparisonLoading(true);
      setComparisonError(null);

      const result = await requestComparison(requestId, replay.id);

      setComparison(result);
    } catch (error) {
      setComparisonError(error instanceof Error ? error.message : "Failed to compare replay");
    } finally {
      setComparisonLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Replay History */}

      <DetailSection title="Replay History">
        {replayHistory.length === 0 ? (
          <EmptyState message="No replay executions yet." />
        ) : (
          <div
            className="
              overflow-hidden
              rounded-lg
              border border-[#292426]
              bg-[#100d0f]
            "
          >
            {/* Header */}

            <div
              className="
                grid
                grid-cols-[minmax(0,1fr)_80px_90px_82px]
                items-center
                gap-4
                border-b border-[#242022]
                bg-[#0e0b0d]
                px-4
                py-2.5
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[#716b6e]
              "
            >
              <span>Executed</span>
              <span>Status</span>
              <span className="text-right">Duration</span>
              <span />
            </div>

            {replayHistory.map((replay) => {
              const isSelected = selectedReplay?.id === replay.id;

              return (
                <div
                  key={replay.id}
                  className={`
                    group
                    grid
                    grid-cols-[minmax(0,1fr)_80px_90px_82px]
                    items-center
                    gap-4
                    border-b border-[#211e20]
                    px-4
                    py-3
                    last:border-b-0
                    transition-colors
                    ${isSelected ? "bg-[#181416]" : "bg-transparent hover:bg-[#141012]"}
                  `}
                >
                  {/* Replay identity */}

                  <button
                    type="button"
                    onClick={() => onSelectReplay(replay)}
                    className="
                      min-w-0
                      text-left
                      outline-none
                    "
                  >
                    <div
                      className={`
                        truncate
                        text-xs
                        font-medium
                        transition-colors
                        ${isSelected ? "text-[#f0eded]" : "text-[#d0cbcc] group-hover:text-[#eee9ea]"}
                      `}
                    >
                      {new Date(replay.createdAt).toLocaleString()}
                    </div>

                    <div
                      className="
                        mt-1
                        truncate
                        font-mono
                        text-[10px]
                        text-[#716b6e]
                      "
                    >
                      {replay.id}
                    </div>
                  </button>

                  {/* Status */}

                  <div>
                    <StatusText status={replay.statusCode} />
                  </div>

                  {/* Duration */}

                  <div
                    className="
                      text-right
                      font-mono
                      text-[11px]
                      text-[#aaa4a7]
                    "
                  >
                    {replay.durationMs}ms
                  </div>

                  {/* Compare */}

                  <button
                    type="button"
                    onClick={() => handleCompare(replay)}
                    disabled={comparisonLoading}
                    className="
                      flex
                      h-7
                      items-center
                      justify-center
                      rounded-md
                      border
                      border-[#302b2d]
                      bg-[#151113]
                      px-2.5
                      font-mono
                      text-[10px]
                      font-medium
                      text-[#bdb7ba]
                      transition-colors
                      hover:border-[#484144]
                      hover:bg-[#1c181a]
                      hover:text-[#f0eded]
                      disabled:cursor-not-allowed
                      disabled:opacity-40
                    "
                  >
                    {comparisonLoading ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="
                            h-2.5
                            w-2.5
                            animate-spin
                            rounded-full
                            border
                            border-[#514a4d]
                            border-t-[#ddd8d9]
                          "
                        />
                        Comparing
                      </span>
                    ) : (
                      "Compare"
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </DetailSection>

      {/* Replay error */}

      {replayError && (
        <div
          className="
            rounded-lg
            border border-red-500/15
            bg-red-950/15
            px-4
            py-3
          "
        >
          <p
            className="
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-red-400/70
            "
          >
            Replay Error
          </p>

          <p className="mt-1 text-xs text-red-300">{replayError}</p>
        </div>
      )}

      {/* Comparison error */}

      {comparisonError && (
        <div
          className="
            rounded-lg
            border border-red-500/15
            bg-red-950/15
            px-4
            py-3
          "
        >
          <p
            className="
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-red-400/70
            "
          >
            Comparison Error
          </p>

          <p className="mt-1 text-xs text-red-300">{comparisonError}</p>
        </div>
      )}

      {/* Selected replay */}

      {selectedReplay && (
        <DetailSection title="Selected Replay">
          <div
            className="
              mb-4
              grid
              grid-cols-1
              gap-3
              sm:grid-cols-3
            "
          >
            <StatCard label="Status" value={String(selectedReplay.statusCode)} mono />

            <StatCard label="Duration" value={`${selectedReplay.durationMs}ms`} mono />

            <StatCard label="Executed" value={new Date(selectedReplay.createdAt).toLocaleString()} />
          </div>

          <div
            className="
              overflow-hidden
              rounded-lg
              border border-[#292426]
              bg-[#100d0f]
            "
          >
            <div
              className="
                border-b
                border-[#242022]
                bg-[#0e0b0d]
                px-4
                py-2.5
              "
            >
              <span
                className="
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-[#716b6e]
                "
              >
                Response Body
              </span>
            </div>

            <div className="p-4">
              <JsonBlock data={selectedReplay.responseBody} />
            </div>
          </div>
        </DetailSection>
      )}

      {/* Replay comparison */}

      {comparison && <RequestComparison comparison={comparison} method={method} path={path} />}
    </div>
  );
}
