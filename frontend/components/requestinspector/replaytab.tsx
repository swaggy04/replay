import { ReplayExecution } from "@/types/request";
import { DetailSection, EmptyState, JsonBlock, StatCard, StatusText } from "./RequestInspector";

export function ReplayTab({
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
                    ${isSelected ? "bg-[#171617]" : "bg-[#111011] hover:bg-[#171617]"}
                  `}
                >
                  {/* Replay identity */}
                  <div className="min-w-0">
                    <div className="truncate text-xs text-[#e2e2e4]">{new Date(replay.createdAt).toLocaleString()}</div>

                    <div className="mt-1 truncate font-mono text-[10px] text-[#d1d1d3]/60">{replay.id}</div>
                  </div>

                  {/* Status */}
                  <StatusText status={replay.statusCode} />

                  {/* Duration */}
                  <div className="text-right font-mono text-[11px] text-[#d1d1d3]">{replay.durationMs}ms</div>
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
            <StatCard label="Status" value={String(selectedReplay.statusCode)} mono />

            <StatCard label="Duration" value={`${selectedReplay.durationMs}ms`} mono />

            <StatCard label="Executed" value={new Date(selectedReplay.createdAt).toLocaleString()} />
          </div>

          {/* Replay response */}
          <JsonBlock data={selectedReplay.responseBody} />
        </DetailSection>
      )}
    </div>
  );
}
