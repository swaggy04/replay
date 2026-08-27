import prisma from "../lib/prisma.js";

export async function requestService() {
  const request = await prisma.requestLog.findMany({
    select: {
      id: true,
      method: true,
      path: true,
      statusCode: true,
      createdAt: true,
    },
    orderBy:{
        createdAt:"desc"
    }
  });
  return request
}
