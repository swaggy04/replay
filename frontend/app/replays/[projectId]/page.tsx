"use client";

import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";

import type { Project, ProjectReplay, ProjectReplaysResponse, ReplayComparison } from "@/types/request";

import { DashboardShell } from "@/components/DashboardShell";
import { getProjectReplays, requestComparison } from "@/components/requestsApi";
import { getMethodClass, getStatusClass } from "@/lib/ui";

function formatDate(date: string) {
  return new Date(date).toLocaleString();
}

export default function ReplaysPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();

  return (
    <DashboardShell
      routeProjectId={projectId}
      onRouteProjectChange={(project: Project) => {
        router.push(`/replays/${project.id}`);
      }}
    >
      {(selectedProject) => <ReplaysView key={selectedProject.id} project={selectedProject} />}
    </DashboardShell>
  );
}

function ReplaysView({ project }: { project: Project }) {
  const { getToken } = useAuth();
  const projectId = project.id;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [replays, setReplays] = useState<ProjectReplay[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [selectedReplay, setSelectedReplay] = useState<ProjectReplay | null>(null);
  const [comparison, setComparison] = useState<ReplayComparison | null>(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const loadReplays = useCallback(
    async (pageNumber: number) => {
      setLoading(true);
      setError(null);

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data: ProjectReplaysResponse = await getProjectReplays(projectId, pageNumber, token);

        setReplays(data.data);
        setPage(data.page);
        setTotalPages(data.totalPages);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch replays.");
      } finally {
        setLoading(false);
      }
    },
    [getToken, projectId],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadReplays(1);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadReplays]);

  const selectReplay = (replay: ProjectReplay) => {
    setSelectedReplay(replay);
    setComparison(null);
    setComparisonError(null);

    (async () => {
      setComparisonLoading(true);

      try {
        const token = await getToken();

        if (!token) {
          throw new Error("Unable to obtain Clerk session token.");
        }

        const data = await requestComparison(replay.requestLogId, replay.id, token);
        setComparison(data);
      } catch (err) {
        setComparisonError(err instanceof Error ? err.message : "Failed to load comparison.");
      } finally {
        setComparisonLoading(false);
      }
    })();
  };

  return (
    <>
      {/* HEADER */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#09090b] px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold tracking-tight text-[#fafafa]">Replays</h1>

            <span className="text-[#3f3f46]">/</span>

            <span className="max-w-[240px] truncate text-xs text-[#a1a1aa]">
              {project.name || projectId}
            </span>
          </div>

          <p className="mt-0.5 text-[10px] text-[#71717a]">Replay executions of captured requests</p>
        </div>

        <div className="shrink-0 text-[11px] font-medium text-[#71717a]">
          {total} {total === 1 ? "replay" : "replays"}
        </div>
      </header>

      {/* ERROR */}
      {error && <div className="border-b border-[#27272a] px-5 py-3 text-xs text-red-400">{error}</div>}

      {/* LIST */}
      <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {loading && replays.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#e4e4e7]" />

            <p className="text-sm font-medium text-[#d4d4d8]">Loading replays</p>

            <p className="mt-1 text-xs text-[#71717a]">Fetching replay executions...</p>
          </div>
        ) : replays.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#27272a] px-4 py-12 text-center">
            <p className="text-sm font-medium text-[#d4d4d8]">No replays yet</p>

            <p className="mt-2 text-xs text-[#71717a]">
              Replays of this project&rsquo;s captured requests will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {replays.map((replay) => {
              const isSelected = selectedReplay?.id === replay.id;

              return (
                <button
                  key={replay.id}
                  type="button"
                  onClick={() => selectReplay(replay)}
                  className={`w-full rounded-md border border-[#1e1e22] px-3 py-3 text-left transition-colors ${
                    isSelected ? "bg-[#18181b]" : "bg-transparent hover:bg-[#131316]"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`w-12 shrink-0 font-mono text-[11px] font-semibold tracking-wide ${getMethodClass(
                        replay.requestLog.method,
                      )}`}
                    >
                      {replay.requestLog.method.toUpperCase()}
                    </span>

                    <span
                      className={`min-w-0 flex-1 truncate font-mono text-xs ${
                        isSelected ? "text-[#fafafa]" : "text-[#d4d4d8]"
                      }`}
                    >
                      {replay.requestLog.path}
                    </span>

                    <span className={`font-mono text-[11px] font-medium ${getStatusClass(replay.statusCode)}`}>
                      {replay.statusCode ?? "—"}
                    </span>

                    <span className="font-mono text-[11px] text-[#71717a]">
                      {typeof replay.durationMs === "number" ? `${replay.durationMs}ms` : "—"}
                    </span>

                    <span className="font-mono text-[10px] text-[#71717a]">{formatDate(replay.createdAt)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* COMPARISON PANEL */}
      {selectedReplay && (
        <div className="border-t border-[#27272a] px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">Comparison</p>

            <button
              type="button"
              onClick={() => setSelectedReplay(null)}
              className="text-[10px] text-[#a1a1aa] transition hover:text-white"
            >
              Close
            </button>
          </div>

          {comparisonLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-3 h-4 w-4 animate-spin rounded-full border-2 border-[#27272a] border-t-[#e4e4e7]" />

              <p className="text-xs text-[#d4d4d8]">Loading comparison...</p>
            </div>
          ) : comparisonError ? (
            <p className="text-xs text-red-400">{comparisonError}</p>
          ) : comparison ? (
            <div className="grid gap-3 text-xs md:grid-cols-2">
              <div className="rounded-md border border-[#27272a] bg-[#131316] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">
                  Original request
                </p>

                <p className="mt-2 font-mono text-sm text-[#fafafa]">
                  {comparison.original.method.toUpperCase()} {comparison.original.path}
                </p>

                <p className="mt-1 font-mono text-[11px] text-[#d4d4d8]">
                  Status {comparison.original.statusCode ?? "—"}
                </p>

                <p className="mt-1 font-mono text-[10px] text-[#71717a]">
                  Executed {formatDate(comparison.original.createdAt)}
                </p>
              </div>

              <div className="rounded-md border border-[#27272a] bg-[#131316] px-4 py-3">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">
                  Replay execution
                </p>

                <p className="mt-2 font-mono text-sm text-[#fafafa]">{comparison.replay?.statusCode ?? "—"}</p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {comparison.statusChanged && (
                    <span className="rounded border border-orange-900/50 bg-orange-950/20 px-2 py-0.5 text-[10px] text-orange-400">
                      status changed
                    </span>
                  )}

                  {comparison.bodyChanged && (
                    <span className="rounded border border-amber-900/50 bg-amber-950/20 px-2 py-0.5 text-[10px] text-amber-400">
                      body changed
                    </span>
                  )}

                  {!comparison.statusChanged && !comparison.bodyChanged && (
                    <span className="rounded border border-emerald-900/50 bg-emerald-950/20 px-2 py-0.5 text-[10px] text-emerald-400">
                      identical
                    </span>
                  )}
                </div>

                <p className="mt-2 font-mono text-[10px] text-[#71717a]">
                  Duration {comparison.replay?.durationMs ?? "—"}ms
                </p>

                <p className="mt-1 font-mono text-[10px] text-[#71717a]">
                  Replayed {comparison.replay ? formatDate(comparison.replay.createdAt) : "—"}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* PAGINATION */}
      <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#27272a] px-5">
        <span className="text-xs text-[#71717a]">
          Page {page} of {totalPages}
        </span>

        <div className="flex gap-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => void loadReplays(page - 1)}
            className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#a1a1aa] transition hover:border-[#3f3f46] hover:bg-[#131316] hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Previous
          </button>

          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => void loadReplays(page + 1)}
            className="rounded-md border border-[#27272a] px-3 py-1.5 text-xs text-[#a1a1aa] transition hover:border-[#3f3f46] hover:bg-[#131316] hover:text-[#f4f4f5] disabled:cursor-not-allowed disabled:opacity-30"
          >
            Next →
          </button>
        </div>
      </footer>
    </>
  );
}
