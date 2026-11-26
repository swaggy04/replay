import type { ReplayComparison } from "@/types/request";

type RequestComparisonProps = {
  comparison: ReplayComparison;
  method: string;
  path: string;
};

export function RequestComparison({ comparison, method, path }: RequestComparisonProps) {
  const { original, replay, statusChanged, bodyChanged } = comparison;

  return (
    <div className="space-y-8">
      {/* Comparison Header */}

      <div className="border-b border-[#27272a] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#fafafa]">Replay Comparison</h3>

            <p className="mt-1 text-xs text-[#71717a]">Compare the original response with the replay result.</p>
          </div>

          {/* Overall result */}

          <div
            className={`
              shrink-0
              rounded-md
              border
              px-2.5
              py-1
              font-mono
              text-[10px]
              font-semibold
              uppercase
              tracking-widest
              ${
                statusChanged || bodyChanged
                  ? "border-amber-500/20 bg-amber-950/10 text-amber-300"
                  : "border-emerald-500/20 bg-emerald-950/10 text-emerald-300"
              }
            `}
          >
            {statusChanged || bodyChanged ? "Changed" : "Match"}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Original Request */}

          <div
            className="
              rounded-lg
              border border-[#27272a]
              bg-[#131316]
              px-4
              py-3
            "
          >
            <div
              className="
                mb-1.5
                font-mono
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[#71717a]
              "
            >
              Original Request
            </div>

            <div className="truncate font-mono text-xs text-[#e4e4e7]">
              {method} {path}
            </div>
          </div>

          {/* Replay */}

          <div
            className="
              rounded-lg
              border border-[#27272a]
              bg-[#131316]
              px-4
              py-3
            "
          >
            <div
              className="
                mb-1.5
                font-mono
                text-[10px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[#71717a]
              "
            >
              Replay
            </div>

            <div className="truncate font-mono text-xs text-[#e4e4e7]">
              {new Date(replay.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>

      {/* Status + Duration */}

      <div
        className="
          overflow-hidden
          rounded-lg
          border border-[#27272a]
          bg-[#131316]
        "
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Original */}

          <div className="border-b border-[#27272a] p-4 md:border-b-0 md:border-r">
            <div className="mb-4 flex items-center justify-between">
              <span
                className="
                  font-mono
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-[#71717a]
                "
              >
                Original
              </span>

              <span className="text-[10px] text-[#52525b]">BASELINE</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[11px] text-[#71717a]">Status</div>

                <div
                  className={`
                    font-mono
                    text-sm
                    font-medium
                    ${statusChanged ? "text-amber-300" : "text-emerald-400"}
                  `}
                >
                  {original.statusCode ?? "—"}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] text-[#71717a]">Duration</div>

                <div className="font-mono text-sm text-[#e4e4e7]">
                  {original.durationMs != null ? `${original.durationMs}ms` : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Replay */}

          <div className="p-4">
            <div className="mb-4 flex items-center justify-between">
              <span
                className="
                  font-mono
                  text-[10px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-[#71717a]
                "
              >
                Replay
              </span>

              <span className="text-[10px] text-[#52525b]">EXECUTION</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[11px] text-[#71717a]">Status</div>

                <div
                  className={`
                    font-mono
                    text-sm
                    font-medium
                    ${statusChanged ? "text-amber-300" : "text-emerald-400"}
                  `}
                >
                  {replay.statusCode}
                </div>
              </div>

              <div>
                <div className="mb-1 text-[11px] text-[#71717a]">Duration</div>

                <div className="font-mono text-sm text-[#e4e4e7]">{replay.durationMs}ms</div>
              </div>
            </div>
          </div>
        </div>

        {/* Status result */}

        {statusChanged && (
          <div
            className="
              flex
              items-center
              gap-2
              border-t border-amber-500/15
              bg-amber-950/10
              px-4
              py-3
            "
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />

            <span className="font-mono text-[11px] text-amber-300">
              Status code changed between original and replay.
            </span>
          </div>
        )}
      </div>

      {/* Response Body */}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-[#fafafa]">Response Body</h4>

            <p className="mt-0.5 text-[11px] text-[#71717a]">Side-by-side response comparison</p>
          </div>

          <span
            className={`
              font-mono
              text-[10px]
              font-semibold
              uppercase
              tracking-[0.1em]
              ${bodyChanged ? "text-amber-300" : "text-emerald-400"}
            `}
          >
            {bodyChanged ? "Different" : "Identical"}
          </span>
        </div>

        <div
          className="
            overflow-hidden
            rounded-lg
            border border-[#27272a]
            bg-[#131316]
          "
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Original Body */}

            <div className="min-w-0 border-b border-[#27272a] md:border-b-0 md:border-r">
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b border-[#27272a]
                  bg-[#0e0b0d]
                  px-4
                  py-2.5
                "
              >
                <span
                  className="
                    font-mono
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-[#71717a]
                  "
                >
                  Original
                </span>
              </div>

              <pre
                className="
                  devreplay-scrollbar
                  max-h-80
                  overflow-auto
                  p-4
                  whitespace-pre-wrap
                  break-words
                  font-mono
                  text-[11px]
                  leading-5
                  text-[#d4d4d8]
                "
              >
                {JSON.stringify(original.responseBody, null, 2)}
              </pre>
            </div>

            {/* Replay Body */}

            <div className="min-w-0">
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b border-[#27272a]
                  bg-[#0e0b0d]
                  px-4
                  py-2.5
                "
              >
                <span
                  className="
                    font-mono
                    text-[10px]
                    font-semibold
                    uppercase
                    tracking-[0.12em]
                    text-[#71717a]
                  "
                >
                  Replay
                </span>
              </div>

              <pre
                className="
                  devreplay-scrollbar
                  max-h-80
                  overflow-auto
                  p-4
                  whitespace-pre-wrap
                  break-words
                  font-mono
                  text-[11px]
                  leading-5
                  text-[#d4d4d8]
                "
              >
                {JSON.stringify(replay.responseBody, null, 2)}
              </pre>
            </div>
          </div>

          {/* Body comparison result */}

          {bodyChanged ? (
            <div
              className="
                flex
                items-center
                gap-2
                border-t border-amber-500/15
                bg-amber-950/10
                px-4
                py-3
              "
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />

              <span className="font-mono text-[11px] text-amber-300">Response body changed</span>
            </div>
          ) : (
            <div
              className="
                flex
                items-center
                gap-2
                border-t border-emerald-500/15
                bg-emerald-950/10
                px-4
                py-3
              "
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />

              <span className="font-mono text-[11px] text-emerald-300">Response body unchanged</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
