"use client";

import type { Project, RequestLog } from "@/types/request";

type RequestSidebarProps = {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (project: Project) => void;

  requests: RequestLog[];
  selectedRequest: RequestLog | null;
  onSelectRequest: (request: RequestLog) => void;
};

export function RequestSidebar({
  projects,
  selectedProject,
  onSelectProject,
  requests,
  selectedRequest,
  onSelectRequest,
}: RequestSidebarProps) {
  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-[#e1dbd6]/20 bg-[#141112]">
      {/* BRAND */}

      <div className="flex h-14 shrink-0 items-center border-b border-[#e1dbd6]/20 px-5">
        <h1 className="text-lg font-semibold text-[#fefefe]">DevReplay</h1>
      </div>

      {/* PROJECT */}

      <div className="border-b border-[#e1dbd6]/20 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#888589]">Project</p>

        <select
          value={selectedProject?.id ?? ""}
          onChange={(event) => {
            const project = projects.find((project) => project.id === event.target.value);

            if (project) {
              onSelectProject(project);
            }
          }}
          className="
            w-full
            rounded-md
            border border-[#e1dbd6]/20
            bg-[#0c080a]
            px-3 py-2
            text-sm text-[#e2e2e4]
            outline-none
            transition
            focus:border-[#e1dbd6]/40
          "
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id} className="bg-[#141112] text-[#e2e2e4]">
              {project.name}
            </option>
          ))}
        </select>
      </div>

      {/* NAVIGATION */}

      <nav className="border-b border-[#e1dbd6]/20 p-3">
        <button
          className="
            flex w-full items-center gap-3
            rounded-md
            bg-[#f9f6f2]/10
            px-3 py-2
            text-sm text-[#fefefe]
          "
        >
          <span className="text-xs">▣</span>
          Requests
        </button>

        <button
          className="
            mt-1 flex w-full items-center gap-3
            rounded-md
            px-3 py-2
            text-sm text-[#a9a5a8]
            transition
            hover:bg-[#f9f6f2]/5
            hover:text-[#e2e2e4]
          "
        >
          <span className="text-xs">↻</span>
          Replays
        </button>

        <button
          className="
            mt-1 flex w-full items-center gap-3
            rounded-md
            px-3 py-2
            text-sm text-[#a9a5a8]
            transition
            hover:bg-[#f9f6f2]/5
            hover:text-[#e2e2e4]
          "
        >
          <span className="text-xs">▱</span>
          Collections
        </button>

        <button
          className="
            mt-1 flex w-full items-center gap-3
            rounded-md
            px-3 py-2
            text-sm text-[#a9a5a8]
            transition
            hover:bg-[#f9f6f2]/5
            hover:text-[#e2e2e4]
          "
        >
          <span className="text-xs">⚙</span>
          Settings
        </button>
      </nav>

      {/* RECENT REQUESTS */}

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[#888589]">Recent</p>

        <div className="space-y-1">
          {requests.map((request) => (
            <button
              key={request.id}
              onClick={() => onSelectRequest(request)}
              className={`
                flex w-full items-center gap-3
                rounded-md
                px-2 py-2
                text-left
                transition
                ${selectedRequest?.id === request.id ? "bg-[#f9f6f2]/10" : "hover:bg-[#f9f6f2]/5"}
              `}
            >
              <span
                className={`
                  w-12 text-[10px] font-semibold
                  ${
                    request.method === "GET"
                      ? "text-sky-400"
                      : request.method === "POST"
                        ? "text-emerald-400"
                        : request.method === "DELETE"
                          ? "text-red-400"
                          : "text-amber-400"
                  }
                `}
              >
                {request.method}
              </span>

              <span className="min-w-0 flex-1 truncate text-xs text-[#c4c0c3]">{request.path}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
