-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN "eventId" TEXT;

-- CreateIndex
-- Scoped to project so the same SDK eventId can exist in different projects.
-- PostgreSQL unique constraints allow multiple NULL eventId rows.
CREATE UNIQUE INDEX "RequestLog_projectId_eventId_key" ON "RequestLog"("projectId", "eventId");
