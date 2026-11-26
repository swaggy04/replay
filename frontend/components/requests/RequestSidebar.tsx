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

type NavItemProps = {
  href: string;
  label: string;
  active: boolean;
  icon: "requests" | "replays" | "collections" | "settings";
};

function NavIcon({ icon }: { icon: NavItemProps["icon"] }) {
  const common = "h-[18px] w-[18px]";
  switch (icon) {
    case "requests":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M8 9l-3 3 3 3M16 9l3 3-3 3M13 8l-2 8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "replays":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 12a8 8 0 1 1-2.34-5.66" strokeLinecap="round" />
          <path d="M20 5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "collections":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M9 5v14M4 9h16" strokeLinecap="round" />
        </svg>
      );
    case "settings":
      return (
        <svg className={common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z" />
          <path d="M18.4 14.3a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.83 2.83l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.91V19a2 2 0 0 1-4 0v-.14a1 1 0 0 0-.67-.91 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.83-2.83l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.91-.6H4a2 2 0 0 1 0-4h.14a1 1 0 0 0 .91-.67 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.83-2.83l.1.1a1 1 0 0 0 1.1.2h.01a1 1 0 0 0 .6-.91V4a2 2 0 0 1 4 0v.14a1 1 0 0 0 .6.91 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.83 2.83l-.1.1a1 1 0 0 0-.2 1.1v.01a1 1 0 0 0 .91.6H20a2 2 0 0 1 0 4h-.14a1 1 0 0 0-.91.6Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

function NavItem({ href, label, active, icon }: NavItemProps) {
  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] transition-colors ${
        active
          ? "bg-[#1f1f22] text-[#fafafa]"
          : "text-[#a1a1aa] hover:bg-[#1b1b1e] hover:text-[#fafafa]"
      }`}
    >
      {active && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />}
      <span className={`${active ? "text-[#fafafa]" : "text-[#71717a] group-hover:text-[#fafafa]"}`}>
        <NavIcon icon={icon} />
      </span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}

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
  const settingsHref = selectedProject ? `/projects/${selectedProject.id}/settings` : "/projects";
  const replaysHref = selectedProject ? `/replays/${selectedProject.id}` : "/";

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-[#27272a] bg-[#0e0e11]">
      <div className="flex h-14 shrink-0 items-center border-b border-[#27272a] px-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-white text-[11px] font-bold text-[#09090b]">
            D
          </div>
          <span className="font-sans text-[15px] font-semibold tracking-tight text-[#fafafa]">DevReplay</span>
        </div>
      </div>

      <div className="border-b border-[#27272a] p-3">
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">Project</p>
          <button
            type="button"
            onClick={onCreateProject}
            title="Create project"
            aria-label="Create project"
            className="flex h-6 w-6 items-center justify-center rounded text-[#71717a] transition hover:bg-[#1f1f22] hover:text-[#fafafa]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="relative">
          <select
            value={selectedProject?.id ?? ""}
            onChange={(event) => {
              const project = projects.find((p) => p.id === event.target.value);
              if (project) onSelectProject(project);
            }}
            disabled={projects.length === 0}
            className="h-9 w-full cursor-pointer appearance-none rounded-md border border-[#27272a] bg-[#18181b] px-3 pr-8 font-mono text-[11px] text-[#e4e1e6] outline-none transition hover:border-[#3f3f46] focus:border-[#52525b] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {projects.length === 0 ? (
              <option value="">No projects</option>
            ) : (
              projects.map((project) => (
                <option key={project.id} value={project.id} className="bg-[#18181b] text-[#e4e1e6]">
                  {project.name}
                </option>
              ))
            )}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#71717a]">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m7 10 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </div>
      </div>

      <nav className="flex flex-col gap-0.5 border-b border-[#27272a] p-3">
        <NavItem href="/" label="Requests" active={active === "requests"} icon="requests" />
        <NavItem href={replaysHref} label="Replays" active={active === "replays"} icon="replays" />
        <NavItem href="/collections" label="Collections" active={active === "collections"} icon="collections" />
        <NavItem href={settingsHref} label="Settings" active={active === "settings"} icon="settings" />
      </nav>

      <div className="devreplay-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 flex items-center justify-between px-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#71717a]">Recent</p>
          {requests.length > 0 && <span className="font-mono text-[10px] text-[#52525b]">{requests.length}</span>}
        </div>

        <div className="space-y-0.5">
          {requests.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-[#52525b]">No captured requests</p>
          ) : (
            requests.map((request) => {
              const isSelected = selectedRequest?.id === request.id;
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => onSelectRequest(request)}
                  className={`group relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors ${
                    isSelected ? "bg-[#1f1f22]" : "hover:bg-[#1b1b1e]"
                  }`}
                >
                  {isSelected && <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />}
                  <span className={`w-11 shrink-0 font-mono text-[10px] font-semibold tracking-wide ${getMethodClass(request.method)}`}>
                    {request.method.toUpperCase()}
                  </span>
                  <span
                    className={`min-w-0 flex-1 truncate font-mono text-[11px] ${
                      isSelected ? "text-[#e4e1e6]" : "text-[#a1a1aa] group-hover:text-[#e4e1e6]"
                    }`}
                  >
                    {request.path}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="flex h-14 shrink-0 items-center border-t border-[#27272a] px-4">
        <div className="flex items-center gap-2 text-[11px] text-[#71717a]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#a1a1aa]" />
          <span className="font-mono uppercase tracking-[0.08em]">Workspace</span>
        </div>
      </div>
    </aside>
  );
}
