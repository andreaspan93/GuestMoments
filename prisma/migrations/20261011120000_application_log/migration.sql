-- CreateTable
CREATE TABLE "application_log" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "targetType" TEXT,
    "targetId" TEXT,
    "result" TEXT NOT NULL,
    "requestId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "application_log_eventType_createdAt_idx" ON "application_log"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "application_log_createdAt_idx" ON "application_log"("createdAt");

-- CreateIndex
CREATE INDEX "application_log_actorId_createdAt_idx" ON "application_log"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "application_log_targetType_targetId_createdAt_idx" ON "application_log"("targetType", "targetId", "createdAt");
