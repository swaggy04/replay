import prisma from "../lib/prisma.js";

export async function requestService(page: number, limit: number) {
  const total = await prisma.requestLog.count({});
  const totalPages = Math.ceil(total / limit);
  const requests = await prisma.requestLog.findMany({
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      method: true,
      path: true,
      statusCode: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
  return {
    requests,
    total,
    page,
    limit,
    totalPages,
  };
}

export async function requestIdService(requestId: string) {
  const individualReq = await prisma.requestLog.findUnique({
    where: {
      id: requestId,
    },
    include: {
      replays: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
  return individualReq;
}

export async function compareReplayService(requestId: string, replayId: string) {
  const original = await prisma.requestLog.findUnique({
    where: {
      id: requestId,
    },
  });
  const replay = await prisma.replayExecution.findUnique({
    where: {
      id: replayId,
    },
  });
  if (!original || !replay) {
    return {
      original,
      replay,
    };
  }

  if (replay.requestLogId !== original.id) {
    return {
      original,
      replay: null,
    };
  }
  const statusChanged = original?.statusCode !== replay?.statusCode;
  const bodyChanged = JSON.stringify(original?.responseBody) !== JSON.stringify(replay?.responseBody);
  return {
    original,
    replay,
    statusChanged,
    bodyChanged,
  };
}
