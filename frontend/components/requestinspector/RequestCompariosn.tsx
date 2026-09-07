import type { ReplayComparison } from "@/types/request";

type RequestComparisonProps = {
  comparison: ReplayComparison;
};

export function RequestComparison({ comparison }: RequestComparisonProps) {
  const { original, replay, statusChanged, bodyChanged } = comparison;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-[#fefefe]">Replay Comparison</h3>
        <p className="mt-1 text-xs text-[#d1d1d3]/50">Compare the original request response with the replay result.</p>
      </div>

      {/* Status + Duration */}
      <div className="overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
        <div className="grid grid-cols-1 divide-y divide-[#2d292a] md:grid-cols-2 md:divide-x md:divide-y-0">
          {/* Original */}
          <div className="p-4">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#d1d1d3]/50">Original</div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 text-[10px] text-[#d1d1d3]/50">Status</div>

                <div className={`font-mono text-sm ${statusChanged ? "text-amber-300" : "text-[#fefefe]"}`}>
                  {original.statusCode ?? "—"}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] text-[#d1d1d3]/50">Duration</div>

                <div className="font-mono text-sm text-[#fefefe]">
                  {original.durationMs != null ? `${original.durationMs}ms` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Replay */}
          <div className="p-4">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-wider text-[#d1d1d3]/50">Replay</div>

            <div className="space-y-4">
              <div>
                <div className="mb-1 text-[10px] text-[#d1d1d3]/50">Status</div>

                <div className={`font-mono text-sm ${statusChanged ? "text-amber-300" : "text-[#fefefe]"}`}>
                  {replay.statusCode}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[10px] text-[#d1d1d3]/50">Duration</div>

                <div className="font-mono text-sm text-[#fefefe]">{replay.durationMs}ms</div>
              </div>
            </div>
          </div>
        </div>

        {statusChanged && (
          <div className="border-t border-amber-500/20 bg-amber-950/10 px-4 py-3 font-mono text-[10px] text-amber-300">
            Status code changed
          </div>
        )}
      </div>

      {/* Response Body */}
      <div>
        <div className="mb-2 text-xs font-medium text-[#fefefe]">Response Body</div>

        <div className="overflow-hidden rounded-md border border-[#2d292a] bg-[#111011]">
          <div className="grid grid-cols-1 divide-y divide-[#2d292a] md:grid-cols-2 md:divide-x md:divide-y-0">
            {/* Original body */}
            <div className="min-w-0 p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#d1d1d3]/50">Original</div>

              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#d1d1d3]">
                {JSON.stringify(original.responseBody, null, 2)}
              </pre>
            </div>

            {/* Replay body */}
            <div className="min-w-0 p-4">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-[#d1d1d3]/50">Replay</div>

              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-[#d1d1d3]">
                {JSON.stringify(replay.responseBody, null, 2)}
              </pre>
            </div>
          </div>

          {bodyChanged ? (
            <div className="border-t border-amber-500/20 bg-amber-950/10 px-4 py-3 font-mono text-[10px] text-amber-300">
              Response body changed
            </div>
          ) : (
            <div className="border-t border-emerald-500/20 bg-emerald-950/10 px-4 py-3 font-mono text-[10px] text-emerald-300">
              Response body unchanged
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
