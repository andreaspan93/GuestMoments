-- Welcome text starts on the guest font. Event names stay bold; other text stays regular.
ALTER TABLE "event" ADD COLUMN "welcomeFont" TEXT NOT NULL DEFAULT 'noto-sans';
ALTER TABLE "event" ADD COLUMN "titleBold" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "event" ADD COLUMN "guestBold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "event" ADD COLUMN "welcomeBold" BOOLEAN NOT NULL DEFAULT false;

UPDATE "event" SET "welcomeFont" = "guestFont";
