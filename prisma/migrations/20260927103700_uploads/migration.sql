-- CreateTable
CREATE TABLE "upload_intent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "brandingSlot" TEXT,
    "originalFileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "contentLength" BIGINT NOT NULL,
    "guestToken" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upload_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT,
    "type" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "guestToken" TEXT NOT NULL,
    "guestName" TEXT NOT NULL DEFAULT '',
    "guestMessage" TEXT NOT NULL DEFAULT '',
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_hit" (
    "id" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rate_limit_hit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "upload_intent_storageKey_key" ON "upload_intent"("storageKey");

-- CreateIndex
CREATE INDEX "upload_intent_eventId_idx" ON "upload_intent"("eventId");

-- CreateIndex
CREATE INDEX "upload_intent_expiresAt_idx" ON "upload_intent"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_storageKey_key" ON "media"("storageKey");

-- CreateIndex
CREATE INDEX "media_eventId_createdAt_idx" ON "media"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "media_eventId_guestToken_idx" ON "media"("eventId", "guestToken");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_hit_bucket_windowStart_key" ON "rate_limit_hit"("bucket", "windowStart");

-- AddForeignKey
ALTER TABLE "upload_intent" ADD CONSTRAINT "upload_intent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
