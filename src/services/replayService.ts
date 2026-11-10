
import prisma from "../lib/prisma.js";

export async function replayService(
  requestId: string,
  ownerId: string
) {
  const requestLog = await prisma.requestLog.findFirst({
    where: {
      id: requestId,
      project: {
        is: {
          ownerId,
        },
      },
    },
  });

  if (!requestLog) {
    return null;
  }

  const url = new URL(
    requestLog.path,
    "http://localhost:5000"
  );

  if (
    requestLog.query &&
    typeof requestLog.query === "object" &&
    !Array.isArray(requestLog.query)
  ) {
    for (const [key, value] of Object.entries(requestLog.query)) {
      url.searchParams.set(key, String(value));
    }
  }

  const body =
    requestLog.method !== "GET" &&
    requestLog.method !== "HEAD" &&
    requestLog.body
      ? JSON.stringify(requestLog.body)
      : undefined;

  return {
    method: requestLog.method,
    url: url.toString(),
    headers: requestLog.headers,
    body,
  };
}

export async function replayHistoryService(
  requestId: string,
  ownerId: string
) {
  // Check ownership before returning replay history.
  const requestLog = await prisma.requestLog.findFirst({
    where: {
      id: requestId,
      project: {
        is: {
          ownerId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!requestLog) {
    return null;
  }

  return prisma.replayExecution.findMany({
    where: {
      requestLogId: requestLog.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
