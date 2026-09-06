"use client";

export type DetailTab = "overview" | "headers" | "query" | "body" | "response" | "replay";

type InspectorTabsProps = {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
};

const tabs: [DetailTab, string][] = [
  ["overview", "Overview"],
  ["headers", "Headers"],
  ["query", "Query"],
  ["body", "Body"],
  ["response", "Response"],
  ["replay", "Replay"],
];

export function InspectorTabs({ activeTab, onChange }: InspectorTabsProps) {
  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-[#2d292a] px-3">
      {tabs.map(([value, label]) => {
        const isActive = activeTab === value;

        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`
              relative shrink-0
              px-4 py-3
              text-xs font-medium
              transition-colors
              ${isActive ? "text-[#fefefe]" : "text-[#d1d1d3] hover:text-[#e2e2e4]"}
            `}
          >
            {label}

            {isActive && (
              <span
                className="
                  absolute inset-x-2 bottom-0
                  h-0.5
                  rounded-full
                  bg-[#fefefe]
                "
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
