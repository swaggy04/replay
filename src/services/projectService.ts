import prisma from "../lib/prisma.js";

export async function createproject(name: string, ownerId: string) {
  return prisma.project.create({
    data: {
      name,
      ownerId,
    },
  });
}

export async function getProjects(ownerId: string) {
  return prisma.project.findMany({
    where: {
      ownerId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

export async function updateProjectReplayBaseUrl(
  projectId: string,
  ownerId: string,
  replayBaseUrl: string | null,
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ownerId },
    select: { id: true },
  });
  if (!project) return null;

  return prisma.project.update({
    where: { id: projectId },
    data: { replayBaseUrl },
  });
}
