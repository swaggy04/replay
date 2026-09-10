import type { Prisma } from "../generated/prisma/client.js";

export type CaptureRequestInput = {
  method: string;
  path: string;
  body?: Prisma.InputJsonValue;
  headers?: Prisma.InputJsonValue;
  query?: Prisma.InputJsonValue;
  statusCode?: number;
  responseBody?: Prisma.InputJsonValue;
  durationMs?: number;
};