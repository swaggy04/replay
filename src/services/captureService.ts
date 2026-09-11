import prisma from "../lib/prisma.js";
import type { CaptureRequestInput } from "../types/capture.js";


export async function captureRequest(input: CaptureRequestInput) {
  const requestLog = await prisma.requestLog.create({
    data: {
      projectId:input.projectId,
      method: input.method,
      path: input.path,
      body: input.body,
      headers: input.headers,
      query: input.query,
      statusCode: input.statusCode,
      responseBody: input.responseBody,
      durationMs: input.durationMs,
    },
  });

  return requestLog;
}
