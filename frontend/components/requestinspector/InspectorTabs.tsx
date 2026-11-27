"use client";

export type DetailTab = "overview" | "headers" | "query" | "body" | "response" | "replay";

type InspectorTabsProps = {
  activeTab: DetailTab;
  onChange: (tab: DetailTab) => void;
};

const tabs: [DetailTab, string][] = [
  ["overview", "Overview"],
  ["headers", "Headers"],
  ["query", "Query Params"],
  ["body", "Request Body"],
  ["response", "Response Body"],
  ["replay", "Replay"],
];

export function InspectorTabs({ activeTab, onChange }: InspectorTabsProps) {
  return (
    <div className="flex shrink-0 overflow-x-auto border-b border-[#27272a] bg-[#0e0e11] px-4">
      {tabs.map(([value, label]) => {
        const isActive = activeTab === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onChange(value)}
            className={`relative shrink-0 px-3 py-3 font-mono text-[10px] transition-colors ${
              isActive ? "text-[#fafafa]" : "text-[#71717a] hover:text-[#d4d4d8]"
            }`}
          >
            {label}
            {isActive && <span className="absolute inset-x-2 bottom-0 h-px bg-[#fafafa]" />}
          </button>
        );
      })}
    </div>
  );
}
