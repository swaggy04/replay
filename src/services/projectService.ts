import prisma from "../lib/prisma.js";

export async function createproject(name:string){
    const project = await prisma.project.create({
      data:{
        name
      }
    })
    return project
}