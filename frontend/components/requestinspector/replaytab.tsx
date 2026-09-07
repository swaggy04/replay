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
}: {
  replayHistory: ReplayExecution[];
  selectedReplay: ReplayExecution | null;
  onSelectReplay: (replay: ReplayExecution) => void;
  replayError: string | null;
  requestId: string;
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
                <div
                  key={replay.id}
                  className={`
                    grid w-full
                    grid-cols-[minmax(0,1fr)_70px_80px_auto]
                    items-center
                    gap-4
                    border-b border-[#211e1f]
                    px-4 py-3
                    last:border-b-0
                    ${isSelected ? "bg-[#171617]" : "bg-[#111011]"}
                  `}
                >
                  {/* Replay identity */}
                  <button
                    type="button"
                    onClick={() => onSelectReplay(replay)}
                    className="
                      min-w-0
                      text-left
                      transition-opacity
                      hover:opacity-80
                    "
                  >
                    <div className="truncate text-xs text-[#e2e2e4]">{new Date(replay.createdAt).toLocaleString()}</div>

                    <div className="mt-1 truncate font-mono text-[10px] text-[#d1d1d3]/60">{replay.id}</div>
                  </button>

                  {/* Status */}
                  <StatusText status={replay.statusCode} />

                  {/* Duration */}
                  <div className="text-right font-mono text-[11px] text-[#d1d1d3]">{replay.durationMs}ms</div>

                  {/* Compare */}
                  <button
                    type="button"
                    onClick={() => handleCompare(replay)}
                    disabled={comparisonLoading}
                    className="
                      rounded-md
                      border border-[#2d292a]
                      bg-[#151314]
                      px-2.5 py-1.5
                      font-mono text-[10px]
                      text-[#d1d1d3]
                      transition-colors
                      hover:border-[#454142]
                      hover:bg-[#1b191a]
                      hover:text-[#fefefe]
                      disabled:cursor-not-allowed
                      disabled:opacity-50
                    "
                  >
                    {comparisonLoading ? "Comparing..." : "Compare"}
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

      {/* Comparison error */}
      {comparisonError && (
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
          {comparisonError}
        </div>
      )}

      {/* Selected replay */}
      {selectedReplay && (
        <DetailSection title="Selected Replay">
          {/* Replay stats */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard label="Status" value={String(selectedReplay.statusCode)} mono />

            <StatCard label="Duration" value={`${selectedReplay.durationMs}ms`} mono />

            <StatCard label="Executed" value={new Date(selectedReplay.createdAt).toLocaleString()} />
          </div>

          {/* Replay response */}
          <JsonBlock data={selectedReplay.responseBody} />
        </DetailSection>
      )}

      {/* Replay comparison */}
      {comparison && <RequestComparison comparison={comparison} />}
    </div>
  );
}
