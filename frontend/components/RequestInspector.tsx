"use client";

import { useState } from "react";

type RequestDetails = {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
  body: unknown;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  responseBody: unknown;
  replays: unknown[];
};

type RequestInspectorProps = {
  request: RequestDetails;
};

type DetailTab = "overview" | "headers" | "query" | "body" | "response";

export default function RequestInspector({ request }: RequestInspectorProps) {
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  return (
    <div className="h-full overflow-y-auto border-t border-zinc-800 bg-[#0f1115] text-zinc-200">
      {/* Header */}
      <div className="border-b border-zinc-800 p-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-blue-400">{request.method}</span>

          <span className="font-mono text-sm text-zinc-300">{request.path}</span>
        </div>

        <div className="mt-2 flex gap-4 text-xs text-zinc-500">
          <span>Status: {request.statusCode ?? "—"}</span>

          <span>Duration: {request.durationMs ?? "—"}ms</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-4">
        {(
          [
            ["overview", "Overview"],
            ["headers", "Headers"],
            ["query", "Query"],
            ["body", "Body"],
            ["response", "Response"],
          ] as [DetailTab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setActiveTab(value)}
            className={`border-b-2 px-4 py-3 text-xs transition ${
              activeTab === value ? "border-white text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-6">
        {activeTab === "overview" && (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500">Request ID</p>

              <p className="mt-1 font-mono text-xs text-zinc-300">{request.id}</p>
            </div>

            <div>
              <p className="text-xs text-zinc-500">Created</p>

              <p className="mt-1 text-sm text-zinc-300">{new Date(request.createdAt).toLocaleString()}</p>
            </div>
          </div>
        )}

        {activeTab === "headers" && <JsonBlock data={request.headers} />}

        {activeTab === "query" && <JsonBlock data={request.query} />}

        {activeTab === "body" && <JsonBlock data={request.body} />}

        {activeTab === "response" && <JsonBlock data={request.responseBody} />}
      </div>
    </div>
  );
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-zinc-800 bg-[#0b0d10] p-4 font-mono text-xs leading-6 text-zinc-300">
      {JSON.stringify(data ?? {}, null, 2)}
    </pre>
  );
}
