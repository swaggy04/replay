
import prisma from "../lib/prisma.js";

export async function requestService(
  page: number,
  limit: number,
  ownerId: string,
  projectId?: string
) {
  const where = {
    project: {
      is: {
        ownerId,
        ...(projectId ? { id: projectId } : {}),
      },
    },
  };

  const total = await prisma.requestLog.count({
    where,
  });

  const totalPages = Math.ceil(total / limit);

  const requests = await prisma.requestLog.findMany({
    where,
    skip: (page - 1) * limit,
    take: limit,
    select: {
      id: true,
      method: true,
      path: true,
      statusCode: true,
      createdAt: true,
      durationMs: true,
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

export async function requestIdService(
  requestId: string,
  ownerId: string
) {
  return prisma.requestLog.findFirst({
    where: {
      id: requestId,
      project: {
        is: {
          ownerId,
        },
      },
    },
    include: {
      replays: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });
}

export async function compareReplayService(
  requestId: string,
  replayId: string,
  ownerId: string
) {
  // First establish that the original request belongs to this user.
  const original = await prisma.requestLog.findFirst({
    where: {
      id: requestId,
      project: {
        is: {
          ownerId,
        },
      },
    },
  });

  if (!original) {
    return {
      original: null,
      replay: null,
    };
  }

  // Then ensure the replay belongs to that exact original request.
  const replay = await prisma.replayExecution.findFirst({
    where: {
      id: replayId,
      requestLogId: original.id,
    },
  });

  if (!replay) {
    return {
      original,
      replay: null,
    };
  }

  const statusChanged = original.statusCode !== replay.statusCode;

  const bodyChanged =
    JSON.stringify(original.responseBody) !==
    JSON.stringify(replay.responseBody);

  return {
    original,
    replay,
    statusChanged,
    bodyChanged,
  };
}
