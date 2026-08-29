-- CreateTable
CREATE TABLE "ReplayExecution" (
    "id" TEXT NOT NULL,
    "requestLogId" TEXT NOT NULL,
    "statusCode" INTEGER,
    "responseBody" JSONB,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReplayExecution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ReplayExecution" ADD CONSTRAINT "ReplayExecution_requestLogId_fkey" FOREIGN KEY ("requestLogId") REFERENCES "RequestLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
