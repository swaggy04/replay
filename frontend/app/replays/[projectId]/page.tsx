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

function JsonPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-[#27272a] bg-[#0e0e11]">
      <div className="border-b border-[#27272a] bg-[#18181b] px-4 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">{title}</span>
      </div>
      <pre className="devreplay-scrollbar max-h-80 overflow-auto p-4 font-mono text-[10px] leading-5 whitespace-pre-wrap break-words text-[#d4d4d8]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
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
        if (!token) throw new Error("Unable to obtain Clerk session token.");

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
        if (!token) throw new Error("Unable to obtain Clerk session token.");
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#27272a] bg-[#0e0e11] px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-mono text-[10px] text-[#71717a]">
            <span>Replays</span>
            <span className="text-[#3f3f46]">/</span>
            <span className="truncate text-[#a1a1aa]">{project.name || projectId}</span>
          </div>
          <h1 className="mt-0.5 text-sm font-semibold tracking-tight text-[#fafafa]">Replay Comparison</h1>
        </div>
        <div className="font-mono text-[10px] text-[#71717a]">
          {total} {total === 1 ? "replay" : "replays"}
        </div>
      </header>

      {error && <div className="border-b border-[#27272a] px-6 py-3 text-xs text-red-400">{error}</div>}

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <section className="flex min-h-0 w-full flex-col border-b border-[#27272a] xl:w-[420px] xl:shrink-0 xl:border-b-0 xl:border-r">
          <div className="border-b border-[#27272a] bg-[#131316] px-5 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">Replay History</p>
          </div>

          <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto">
            {loading && replays.length === 0 && !error ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#fafafa]" />
                <p className="text-sm font-medium text-[#d4d4d8]">Loading replays</p>
              </div>
            ) : replays.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm font-medium text-[#d4d4d8]">No replays yet</p>
                <p className="mt-2 text-xs text-[#71717a]">Replay executions for this project will appear here.</p>
              </div>
            ) : (
              replays.map((replay) => {
                const isSelected = selectedReplay?.id === replay.id;
                return (
                  <button
                    key={replay.id}
                    type="button"
                    onClick={() => selectReplay(replay)}
                    className={`w-full border-b border-[#1f1f23] px-5 py-4 text-left transition-colors ${
                      isSelected ? "bg-[#1f1f22]" : "hover:bg-[#1b1b1e]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`font-mono text-[10px] font-semibold tracking-wide ${getMethodClass(replay.requestLog.method)}`}>
                          {replay.requestLog.method.toUpperCase()}
                        </span>
                        <span className={`truncate font-mono text-[10px] ${isSelected ? "text-[#fafafa]" : "text-[#d4d4d8]"}`}>
                          {replay.requestLog.path}
                        </span>
                      </div>
                      <span className={`font-mono text-[10px] font-medium ${getStatusClass(replay.statusCode)}`}>
                        {replay.statusCode ?? "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-3 font-mono text-[10px] text-[#71717a]">
                      <span>{typeof replay.durationMs === "number" ? `${replay.durationMs}ms` : "—"}</span>
                      <span>{formatDate(replay.createdAt)}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <footer className="flex h-12 shrink-0 items-center justify-between border-t border-[#27272a] px-5">
            <span className="font-mono text-[10px] text-[#71717a]">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => void loadReplays(page - 1)}
                className="rounded-md border border-[#27272a] px-3 py-1.5 text-[10px] text-[#a1a1aa] transition hover:bg-[#1f1f22] hover:text-[#fafafa] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => void loadReplays(page + 1)}
                className="rounded-md border border-[#27272a] px-3 py-1.5 text-[10px] text-[#a1a1aa] transition hover:bg-[#1f1f22] hover:text-[#fafafa] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Next
              </button>
            </div>
          </footer>
        </section>

        <section className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#131316]">
          {!selectedReplay ? (
            <div className="flex h-full min-h-[280px] items-center justify-center px-6 py-16 text-center">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717a]">Comparison</p>
                <p className="mt-3 text-sm font-medium text-[#d4d4d8]">Select a replay to compare</p>
                <p className="mt-1 text-xs text-[#71717a]">Original request and replay execution details will appear here.</p>
              </div>
            </div>
          ) : comparisonLoading ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center px-6 py-16">
              <div className="mb-4 h-5 w-5 animate-spin rounded-full border-2 border-[#27272a] border-t-[#fafafa]" />
              <p className="text-sm text-[#d4d4d8]">Loading comparison...</p>
            </div>
          ) : comparisonError ? (
            <div className="px-6 py-8">
              <div className="rounded-md border border-red-900/40 bg-red-950/20 px-4 py-3 text-xs text-red-400">{comparisonError}</div>
            </div>
          ) : comparison ? (
            <div className="space-y-6 px-6 py-6">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#27272a] pb-5">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#71717a]">Replay Comparison</p>
                  <h2 className="mt-2 font-mono text-sm text-[#fafafa]">
                    <span className={getMethodClass(comparison.original.method)}>{comparison.original.method.toUpperCase()}</span>{" "}
                    <span className="text-[#d4d4d8]">{comparison.original.path}</span>
                  </h2>
                  <p className="mt-1 text-xs text-[#71717a]">Original captured request vs selected replay execution.</p>
                </div>
                <div className="flex items-center gap-2">
                  {comparison.statusChanged && (
                    <span className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-400">
                      Status changed
                    </span>
                  )}
                  {comparison.bodyChanged && (
                    <span className="rounded border border-amber-900/40 bg-amber-950/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-amber-400">
                      Body changed
                    </span>
                  )}
                  {!comparison.statusChanged && !comparison.bodyChanged && (
                    <span className="rounded border border-emerald-900/40 bg-emerald-950/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-emerald-400">
                      Identical
                    </span>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-[#27272a] bg-[#1b1b1e] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">Original Request</p>
                    <span className="font-mono text-[10px] text-[#52525b]">Baseline</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Status</p>
                      <p className={`mt-1 font-mono text-sm ${getStatusClass(comparison.original.statusCode)}`}>{comparison.original.statusCode ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Duration</p>
                      <p className="mt-1 font-mono text-sm text-[#d4d4d8]">{comparison.original.durationMs != null ? `${comparison.original.durationMs}ms` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Captured</p>
                      <p className="mt-1 font-mono text-[10px] text-[#a1a1aa]">{formatDate(comparison.original.createdAt)}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-md border border-[#27272a] bg-[#1b1b1e] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">Replay Execution</p>
                    <span className="font-mono text-[10px] text-[#52525b]">Execution</span>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Status</p>
                      <p className={`mt-1 font-mono text-sm ${getStatusClass(comparison.replay.statusCode)}`}>{comparison.replay.statusCode ?? "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Duration</p>
                      <p className="mt-1 font-mono text-sm text-[#d4d4d8]">{comparison.replay.durationMs != null ? `${comparison.replay.durationMs}ms` : "—"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.08em] text-[#71717a]">Replayed</p>
                      <p className="mt-1 font-mono text-[10px] text-[#a1a1aa]">{formatDate(comparison.replay.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-[#fafafa]">Response Body Comparison</h3>
                    <p className="mt-0.5 text-xs text-[#71717a]">Side-by-side original and replay response bodies.</p>
                  </div>
                  <span className={`font-mono text-[10px] uppercase tracking-[0.08em] ${comparison.bodyChanged ? "text-amber-400" : "text-emerald-400"}`}>
                    {comparison.bodyChanged ? "Different" : "Identical"}
                  </span>
                </div>
                <div className="grid gap-4 xl:grid-cols-2">
                  <JsonPanel title="Original response" value={comparison.original.responseBody} />
                  <JsonPanel title="Replay response" value={comparison.replay.responseBody} />
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}
