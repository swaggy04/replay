"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Project, RequestLog } from "@/types/request";
import { activeNavForPathname, getMethodClass } from "@/lib/ui";

type RequestSidebarProps = {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;
  onCreateProject: () => void;
  requests: RequestLog[];
  selectedRequest: RequestLog | null;
  onSelectRequest: (request: RequestLog) => void;
};

const navButtonBase =
  "group flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-xs transition-colors";
const navButtonActive = "border border-[#3f3f46] bg-[#18181b] text-[#fafafa] font-medium";
const navButtonInactive =
  "border border-transparent text-[#a1a1aa] hover:bg-[#18181b] hover:text-[#fafafa]";

export function RequestSidebar({
  projects,
  selectedProject,
  onSelectProject,
  onCreateProject,
  requests,
  selectedRequest,
  onSelectRequest,
}: RequestSidebarProps) {
  const pathname = usePathname();
  const active = activeNavForPathname(pathname);
  const settingsHref = selectedProject
    ? `/projects/${selectedProject.id}/settings`
    : "/projects";
  const replaysHref = selectedProject ? `/replays/${selectedProject.id}` : "/";

  function getNavClass(key: string) {
    return active === key ? navButtonActive : navButtonInactive;
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[#27272a] bg-[#0e0e11]">
      <div className="flex h-14 shrink-0 items-center border-b border-[#27272a] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-[#fafafa] text-[11px] font-semibold text-[#09090b]">
            D
          </div>
          <span className="text-[15px] font-semibold tracking-tight text-[#fafafa]">DevReplay</span>
        </div>
      </div>

      <div className="border-b border-[#27272a] px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">Project</p>

          <button
            type="button"
            onClick={onCreateProject}
            title="Create project"
            aria-label="Create project"
            className="flex h-6 w-6 items-center justify-center rounded-md text-base text-[#a1a1aa] transition hover:bg-[#18181b] hover:text-white"
          >
            +
          </button>
        </div>

        <div className="relative">
          <select
            value={selectedProject?.id ?? ""}
            onChange={(event) => {
              const project = projects.find((project) => project.id === event.target.value);

              if (project) onSelectProject(project);
            }}
            disabled={projects.length === 0}
            className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-[#27272a] bg-[#131316] px-3 pr-8 text-xs font-medium text-[#e4e4e7] outline-none transition hover:border-[#3f3f46] focus:border-[#52525b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id} className="bg-[#131316] text-[#e4e4e7]">
                  {project.name}
                </option>
              ))
            )}
          </select>

          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#71717a]">
            ▾
          </span>
        </div>
      </div>

      <nav className="border-b border-[#27272a] px-3 py-3">
        <Link href="/" className={`${navButtonBase} ${getNavClass("requests")}`}>
          <span className="flex w-4 justify-center text-[12px] text-[#a1a1aa] group-hover:text-[#fafafa]">▣</span>
          <span>Requests</span>
        </Link>

        <Link href={replaysHref} className={`mt-1 ${navButtonBase} ${getNavClass("replays")}`}>
          <span className="flex w-4 justify-center text-[12px] text-[#a1a1aa] group-hover:text-[#fafafa]">↻</span>
          <span>Replays</span>
        </Link>

        <Link href="/collections" className={`mt-1 ${navButtonBase} ${getNavClass("collections")}`}>
          <span className="flex w-4 justify-center text-[12px] text-[#a1a1aa] group-hover:text-[#fafafa]">▱</span>
          <span>Collections</span>
        </Link>

        <Link href={settingsHref} className={`mt-1 ${navButtonBase} ${getNavClass("settings")}`}>
          <span className="flex w-4 justify-center text-[12px] text-[#a1a1aa] group-hover:text-[#fafafa]">⚙</span>
          <span>Settings</span>
        </Link>
      </nav>

      <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#71717a]">Recent</p>

          {requests.length > 0 && <span className="font-mono text-[10px] text-[#52525b]">{requests.length}</span>}
        </div>

        <div className="space-y-0.5">
          {requests.map((request) => {
            const isSelected = selectedRequest?.id === request.id;

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => onSelectRequest(request)}
                className={`group relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                  isSelected ? "bg-[#18181b] text-[#fafafa]" : "hover:bg-[#18181b]"
                }`}
              >
                {isSelected && (
                  <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-[#fafafa]" />
                )}

                <span
                  className={`w-12 shrink-0 font-mono text-[10px] font-semibold tracking-wide ${getMethodClass(
                    request.method,
                  )}`}
                >
                  {request.method.toUpperCase()}
                </span>

                <span
                  className={`min-w-0 flex-1 truncate font-mono text-[11px] transition-colors ${
                    isSelected ? "text-[#f4f4f5]" : "text-[#a1a1aa] group-hover:text-[#e4e4e7]"
                  }`}
                >
                  {request.path}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex h-14 shrink-0 items-center justify-between border-t border-[#27272a] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#27272a] bg-[#131316] text-xs font-medium text-[#e4e4e7]">
            N
          </div>

          <div>
            <p className="text-[11px] font-medium text-[#d4d4d8]">Developer</p>
            <p className="text-[10px] text-[#71717a]">Local workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
