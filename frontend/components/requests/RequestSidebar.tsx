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
  function getMethodClass(method: string) {
    switch (method.toUpperCase()) {
      case "GET":
        return "text-emerald-400";

      case "POST":
        return "text-[#F4D77E]";

      case "PUT":
        return "text-blue-400";

      case "PATCH":
        return "text-purple-400";

      case "DELETE":
        return "text-red-400";

      case "HEAD":
        return "text-emerald-300";

      case "OPTIONS":
        return "text-pink-400";

      default:
        return "text-[#d8d4d5]";
    }
  }

  return (
    <aside
      className="
        flex
        w-64
        shrink-0
        flex-col
        border-r border-[#242022]
        bg-[#100d0f]
      "
    >
      {/* BRAND */}

      <div
        className="
          flex
          h-14
          shrink-0
          items-center
          border-b border-[#242022]
          px-5
        "
      >
        <div className="flex items-center gap-2.5">
          <div
            className="
              flex
              h-6
              w-6
              items-center
              justify-center
              rounded-md
              border border-[#342e31]
              bg-[#171315]
              text-[11px]
              font-semibold
              text-[#d8d4d5]
            "
          >
            D
          </div>

          <span
            className="
              text-[15px]
              font-semibold
              tracking-tight
              text-[#f5f3f3]
            "
          >
            DevReplay
          </span>
        </div>
      </div>

      {/* PROJECT */}

      <div
        className="
          border-b border-[#242022]
          px-4
          py-4
        "
      >
        <p
          className="
            mb-2
            text-[9px]
            font-semibold
            uppercase
            tracking-[0.12em]
            text-[#716b6e]
          "
        >
          Project
        </p>

        <div className="relative">
          <select
            value={selectedProject?.id ?? ""}
            onChange={(event) => {
              const project = projects.find((project) => project.id === event.target.value);

              if (project) {
                onSelectProject(project);
              }
            }}
            className="
              h-9
              w-full
              cursor-pointer
              appearance-none
              rounded-md
              border border-[#302b2d]
              bg-[#0c080a]
              px-3
              pr-8
              text-xs
              font-medium
              text-[#ddd9da]
              outline-none
              transition
              hover:border-[#3b3538]
              focus:border-[#4a4245]
              focus:ring-1
              focus:ring-[#4a4245]/30
            "
          >
            {projects.map((project) => (
              <option
                key={project.id}
                value={project.id}
                className="
                  bg-[#141012]
                  text-[#e2dfe0]
                "
              >
                {project.name}
              </option>
            ))}
          </select>

          <span
            className="
              pointer-events-none
              absolute
              right-3
              top-1/2
              -translate-y-1/2
              text-[10px]
              text-[#716b6e]
            "
          >
            ▾
          </span>
        </div>
      </div>

      {/* NAVIGATION */}

      <nav
        className="
          border-b border-[#242022]
          px-3
          py-3
        "
      >
        {/* Requests */}

        <button
          type="button"
          className="
            flex
            h-9
            w-full
            items-center
            gap-3
            rounded-md
            bg-[#1a1618]
            px-3
            text-xs
            font-medium
            text-[#f1eeee]
          "
        >
          <span
            className="
              flex
              w-4
              justify-center
              text-[11px]
              text-[#c9c5c6]
            "
          >
            ▣
          </span>

          <span>Requests</span>
        </button>

        {/* Replays */}

        <button
          type="button"
          className="
            mt-1
            flex
            h-9
            w-full
            items-center
            gap-3
            rounded-md
            px-3
            text-xs
            font-medium
            text-[#918b8e]
            transition-colors
            hover:bg-[#161214]
            hover:text-[#d9d5d6]
          "
        >
          <span
            className="
              flex
              w-4
              justify-center
              text-[11px]
            "
          >
            ↻
          </span>

          <span>Replays</span>
        </button>

        {/* Collections */}

        <button
          type="button"
          className="
            mt-1
            flex
            h-9
            w-full
            items-center
            gap-3
            rounded-md
            px-3
            text-xs
            font-medium
            text-[#918b8e]
            transition-colors
            hover:bg-[#161214]
            hover:text-[#d9d5d6]
          "
        >
          <span
            className="
              flex
              w-4
              justify-center
              text-[11px]
            "
          >
            ▱
          </span>

          <span>Collections</span>
        </button>

        {/* Settings */}

        <button
          type="button"
          className="
            mt-1
            flex
            h-9
            w-full
            items-center
            gap-3
            rounded-md
            px-3
            text-xs
            font-medium
            text-[#918b8e]
            transition-colors
            hover:bg-[#161214]
            hover:text-[#d9d5d6]
          "
        >
          <span
            className="
              flex
              w-4
              justify-center
              text-[11px]
            "
          >
            ⚙
          </span>

          <span>Settings</span>
        </button>
      </nav>

      {/* RECENT REQUESTS */}

      <div
        className="
          devreplay-scrollbar
          min-h-0
          flex-1
          overflow-y-auto
          px-3
          py-4
        "
      >
        <div className="mb-2 flex items-center justify-between px-2">
          <p
            className="
              text-[9px]
              font-semibold
              uppercase
              tracking-[0.12em]
              text-[#716b6e]
            "
          >
            Recent
          </p>

          {requests.length > 0 && <span className="font-mono text-[9px] text-[#514b4e]">{requests.length}</span>}
        </div>

        <div className="space-y-0.5">
          {requests.map((request) => {
            const isSelected = selectedRequest?.id === request.id;

            return (
              <button
                key={request.id}
                type="button"
                onClick={() => onSelectRequest(request)}
                className={`
                  group
                  relative
                  flex
                  w-full
                  items-center
                  gap-3
                  rounded-md
                  px-2
                  py-2
                  text-left
                  transition-colors
                  ${isSelected ? "bg-[#1a1618]" : "hover:bg-[#161214]"}
                `}
              >
                {/* Selected indicator */}

                {isSelected && (
                  <span
                    className="
                      absolute
                      left-0
                      top-1/2
                      h-4
                      w-0.5
                      -translate-y-1/2
                      rounded-full
                      bg-[#d8d4d5]
                    "
                  />
                )}

                {/* METHOD */}

                <span
                  className={`
                    w-12
                    shrink-0
                    font-mono
                    text-[10px]
                    font-semibold
                    tracking-wide
                    ${getMethodClass(request.method)}
                  `}
                >
                  {request.method.toUpperCase()}
                </span>

                {/* PATH */}

                <span
                  className={`
                    min-w-0
                    flex-1
                    truncate
                    font-mono
                    text-[11px]
                    transition-colors
                    ${isSelected ? "text-[#eee9ea]" : "text-[#9d979a] group-hover:text-[#d0cbcc]"}
                  `}
                >
                  {request.path}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* BOTTOM */}

      <div
        className="
          flex
          h-14
          shrink-0
          items-center
          justify-between
          border-t border-[#242022]
          px-4
        "
      >
        <div className="flex items-center gap-2.5">
          <div
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              border border-[#302b2d]
              bg-[#0c080a]
              text-xs
              font-medium
              text-[#d8d4d5]
            "
          >
            N
          </div>

          <div>
            <p className="text-[11px] font-medium text-[#bdb8ba]">Developer</p>

            <p className="text-[9px] text-[#615b5e]">Local workspace</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
