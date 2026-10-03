ALTER TABLE "user" ADD COLUMN "accessStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "user" ADD COLUMN "accessExpiresAt" TIMESTAMP(3);

-- Accounts created before service access stay usable. New registrations stay PENDING.
UPDATE "user" SET "emailVerified" = true WHERE "emailVerified" = false;
UPDATE "user"
SET "accessStatus" = CASE WHEN "disabled" = true THEN 'DISABLED' ELSE 'ACTIVE' END;
