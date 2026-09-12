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

      <div className="border-b border-[#292426] pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold tracking-tight text-[#f1eeee]">Replay Comparison</h3>

            <p className="mt-1 text-xs text-[#716b6e]">Compare the original response with the replay result.</p>
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
              text-[9px]
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
              border border-[#292426]
              bg-[#100d0f]
              px-4
              py-3
            "
          >
            <div
              className="
                mb-1.5
                font-mono
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[#716b6e]
              "
            >
              Original Request
            </div>

            <div className="truncate font-mono text-xs text-[#d8d4d5]">
              {method} {path}
            </div>
          </div>

          {/* Replay */}

          <div
            className="
              rounded-lg
              border border-[#292426]
              bg-[#100d0f]
              px-4
              py-3
            "
          >
            <div
              className="
                mb-1.5
                font-mono
                text-[9px]
                font-semibold
                uppercase
                tracking-[0.12em]
                text-[#716b6e]
              "
            >
              Replay
            </div>

            <div className="truncate font-mono text-xs text-[#d8d4d5]">
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
          border border-[#292426]
          bg-[#100d0f]
        "
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Original */}

          <div className="border-b border-[#242022] p-4 md:border-b-0 md:border-r">
            <div className="mb-4 flex items-center justify-between">
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
                Original
              </span>

              <span className="text-[9px] text-[#514b4e]">BASELINE</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[10px] text-[#716b6e]">Status</div>

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
                <div className="mb-1 text-[10px] text-[#716b6e]">Duration</div>

                <div className="font-mono text-sm text-[#d8d4d5]">
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
                  text-[9px]
                  font-semibold
                  uppercase
                  tracking-[0.12em]
                  text-[#716b6e]
                "
              >
                Replay
              </span>

              <span className="text-[9px] text-[#514b4e]">EXECUTION</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mb-1 text-[10px] text-[#716b6e]">Status</div>

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
                <div className="mb-1 text-[10px] text-[#716b6e]">Duration</div>

                <div className="font-mono text-sm text-[#d8d4d5]">{replay.durationMs}ms</div>
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

            <span className="font-mono text-[10px] text-amber-300">
              Status code changed between original and replay.
            </span>
          </div>
        )}
      </div>

      {/* Response Body */}

      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h4 className="text-xs font-semibold text-[#e2dfe0]">Response Body</h4>

            <p className="mt-0.5 text-[10px] text-[#716b6e]">Side-by-side response comparison</p>
          </div>

          <span
            className={`
              font-mono
              text-[9px]
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
            border border-[#292426]
            bg-[#100d0f]
          "
        >
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Original Body */}

            <div className="min-w-0 border-b border-[#242022] md:border-b-0 md:border-r">
              <div
                className="
                  flex
                  items-center
                  justify-between
                  border-b border-[#242022]
                  bg-[#0e0b0d]
                  px-4
                  py-2.5
                "
              >
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
                  text-[#bdb8ba]
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
                  border-b border-[#242022]
                  bg-[#0e0b0d]
                  px-4
                  py-2.5
                "
              >
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
                  text-[#bdb8ba]
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

              <span className="font-mono text-[10px] text-amber-300">Response body changed</span>
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

              <span className="font-mono text-[10px] text-emerald-300">Response body unchanged</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
