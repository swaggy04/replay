export  type RequestDetails = {
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
