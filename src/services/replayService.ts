import prisma from "../lib/prisma.js";

export async function replayService(requestId: string) {
  const requestLog = await prisma.requestLog.findUnique({
    where: {
      id: requestId,
    },
  });
  if (!requestLog) {
    return null;
  }
  const url = new URL(requestLog.path, "http://localhost:3000");
  ///// to check if the query exists as a n obj
  if (requestLog.query && typeof requestLog.query === "object") {
    for (const [key, value] of Object.entries(requestLog.query)) {
      url.searchParams.set(key, String(value));
    }
  }
  const body = requestLog.body ? JSON.stringify(requestLog.body) : undefined;

  return {
    method: requestLog.method,
   url:url.toString(),
    headers: requestLog.headers,
    body,
  };
}
