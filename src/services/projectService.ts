import prisma from "../lib/prisma.js";

export async function createproject(name: string) {
  const project = await prisma.project.create({
    data: {
      name,
    },
  });
  return project;
}

export async function getProjects() {
  const projects = await prisma.project.findMany({
    orderBy: {
      createdAt: "desc",
    },
  });
  return projects;
}
