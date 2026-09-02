export type RequestLog = {
  id: string;
  method: string;
  path: string;
  statusCode: number | null;
  createdAt: string;
  durationMs: number;
};

export type RequestDetails = RequestLog & {
  durationMs: number | null;
  body: unknown;
  headers: Record<string, unknown>;
  query: Record<string, unknown>;
  responseBody: unknown;
  replays: ReplayExecution[];
};

export type ReplayExecution = {
  id: string;
  requestLogId: string;
  statusCode: number;
  responseBody: unknown;
  durationMs: number;
  createdAt: string;
};

export type RequestsResponse = {
  data: RequestLog[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};
