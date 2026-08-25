-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "headers" JSONB,
ADD COLUMN     "query" JSONB;
