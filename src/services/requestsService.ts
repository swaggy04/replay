import prisma from "../lib/prisma.js";

export async function requestService() {
  const requests = await prisma.requestLog.findMany({
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
  return requests
}


export async function requestId( requestId:string){
    const individualReq = await prisma.requestLog.findUnique({
        where:{
            id:requestId
        }
    }) 
    return individualReq
}
