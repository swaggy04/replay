import { Prisma } from "../generated/prisma/client.js";
import prisma from "../lib/prisma.js";
import type { CaptureRequestInput } from "../types/capture.js";

export type CaptureWriteResult = {
  id: string;
  eventId?: string | null;
  duplicate: boolean;
};

export type CaptureBatchItemResult = {
  eventId?: string;
  id?: string;
  duplicate: boolean;
  error?: string;
  retryable?: boolean;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Explicit, code-level classification. Families are NOT treated uniformly.
const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // can't reach database server
  "P1002", // database server timed out
  "P1008", // operations timed out
  "P1017", // server closed the connection
  "P2024", // timed out fetching a connection from the pool
  "P2028", // transaction API error
  "P2034", // transaction failed due to write conflict (retryable)
]);

const PERMANENT_PRISMA_CODES = new Set([
  "P2000", // value too long
  "P2001", // record does not exist
  "P2002", // unique constraint (handled idempotently upstream, still permanent data state)
  "P2003", // foreign key constraint
  "P2004", // constraint failed
  "P2005", // invalid value for field type
  "P2006", // invalid value for field type
  "P2007", // data validation error
  "P2011", // null constraint
  "P2012", // missing required value
  "P2013", // missing required argument
  "P2014", // relation violation
  "P2015", // related record not found
  "P2016", // query interpretation error
  "P2017", // records not connected
  "P2018", // required connected records not found
  "P2019", // input error
  "P2020", // value out of range
  "P2021", // table does not exist
  "P2022", // column does not exist
  "P2023", // inconsistent column data
  "P2025", // record not found
  "P2026", // unsupported feature
  "P2027", // multiple errors during transaction
  "P2029", // query parameter limit
  "P2030", // cannot find a fulltext index
  "P2031", // prisma needs to be regenerated (schema drift)
  "P2032", // error in number conversion
  "P2033", // value out of range for type
]);

export function isPermanentCaptureError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (TRANSIENT_PRISMA_CODES.has(error.code)) return false;
    if (PERMANENT_PRISMA_CODES.has(error.code)) return true;
    // Unknown Prisma code: default transient (retry rather than drop).
    return false;
  }
  if (error instanceof Prisma.PrismaClientValidationError) return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return false;
  if (error instanceof Prisma.PrismaClientRustPanicError) return false;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    // Unknown request error: default transient.
    return false;
  }
  // Generic network/timeout errors are transient.
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (
      msg.includes("connect") ||
      msg.includes("timeout") ||
      msg.includes("econn") ||
      msg.includes("fetch failed") ||
      msg.includes("network")
    ) {
      return false;
    }
  }
  // Default unknown errors: transient (retry rather than drop).
  return false;
}

function normalizeDurationMs(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.round(value);
}

export async function captureRequest(
  input: CaptureRequestInput,
): Promise<CaptureWriteResult> {
  const data = {
    projectId: input.projectId,
    eventId: input.eventId,
    method: input.method,
    path: input.path,
    body: input.body,
    headers: input.headers,
    query: input.query,
    statusCode: input.statusCode,
    responseBody: input.responseBody,
    durationMs: normalizeDurationMs(input.durationMs),
  };

  try {
    const created = await prisma.requestLog.create({
      data,
      select: { id: true, eventId: true },
    });
    return { id: created.id, eventId: created.eventId, duplicate: false };
  } catch (error) {
    // Idempotent retry: if the same (projectId,eventId) was already ingested, treat as success.
    if (input.eventId && input.projectId && isUniqueConstraintError(error)) {
      try {
        const existing = await prisma.requestLog.findUnique({
          where: {
            projectId_eventId: {
              projectId: input.projectId,
              eventId: input.eventId,
            },
          } as any,
          select: { id: true, eventId: true },
        });
        if (existing) {
          return { id: existing.id, eventId: existing.eventId, duplicate: true };
        }
      } catch {
        // fall through to original error
      }
    }
    throw error;
  }
}

export async function captureRequests(
  inputs: CaptureRequestInput[],
): Promise<{
  results: CaptureBatchItemResult[];
  accepted: number;
  duplicates: number;
  failed: number;
}> {
  const results: CaptureBatchItemResult[] = [];
  let accepted = 0;
  let duplicates = 0;
  let failed = 0;

  for (const input of inputs) {
    try {
      const result = await captureRequest(input);
      results.push({
        eventId: result.eventId ?? input.eventId,
        id: result.id,
        duplicate: result.duplicate,
      });
      if (result.duplicate) duplicates += 1;
      else accepted += 1;
    } catch (error) {
      failed += 1;
      results.push({
        eventId: input.eventId,
        duplicate: false,
        error: "Failed to capture request",
        retryable: !isPermanentCaptureError(error),
      });
    }
  }

  return { results, accepted, duplicates, failed };
}