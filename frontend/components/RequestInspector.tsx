"use client";

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

export default function RequestInspector({ request }: RequestInspectorProps) {
  return (
    <div className="h-full overflow-y-auto border-t border-zinc-800 bg-[#0f1115] p-6 text-zinc-200">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-blue-400">{request.method}</span>

          <span className="font-mono text-sm text-zinc-200">{request.path}</span>
        </div>

        <div className="mt-2 flex gap-4 text-xs">
          <span className="text-emerald-400">{request.statusCode ?? "Unknown"}</span>

          <span className="text-zinc-500">{request.durationMs ?? "—"}ms</span>

          <span className="text-zinc-500">{new Date(request.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Request information */}
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Query</h3>

          <JsonBlock data={request.query} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Headers</h3>

          <JsonBlock data={request.headers} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Body</h3>

          <JsonBlock data={request.body} />
        </section>

        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">Response</h3>

          <JsonBlock data={request.responseBody} />
        </section>
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
