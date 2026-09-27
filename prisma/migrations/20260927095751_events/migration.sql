-- CreateTable
CREATE TABLE "platform_settings" (
    "id" TEXT NOT NULL,
    "defaultRetentionDays" INTEGER NOT NULL,
    "maxPhotoBytes" BIGINT NOT NULL,
    "maxVideoBytes" BIGINT NOT NULL,
    "defaultMaxStorageBytes" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "uniqueCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "welcomeMessageEl" TEXT NOT NULL DEFAULT '',
    "welcomeMessageEn" TEXT NOT NULL DEFAULT '',
    "uploadInstructionsEl" TEXT NOT NULL DEFAULT '',
    "uploadInstructionsEn" TEXT NOT NULL DEFAULT '',
    "coverKey" TEXT,
    "logoKey" TEXT,
    "backgroundColor" TEXT NOT NULL,
    "backgroundImageKey" TEXT,
    "accentColor" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "privacyMode" TEXT NOT NULL DEFAULT 'FULL_GALLERY',
    "retentionDays" INTEGER NOT NULL,
    "maxStorageBytes" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "storagePurgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_customerId_idx" ON "event"("customerId");

-- CreateIndex
CREATE INDEX "event_expiresAt_idx" ON "event"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "event_uniqueCode_key" ON "event"("uniqueCode");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
