import prisma from "../lib/prisma.js";

export async function requestService(page: number, limit: number) {
  const total = await prisma.requestLog.count({});
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
  };
}

export async function requestIdService(requestId: string) {
  const individualReq = await prisma.requestLog.findUnique({
    where: {
      id: requestId,
    },
  });
  return individualReq;
}
