-- Event retention is no longer a separate clock. Customer access expiry
-- is the only automatic deletion trigger. Existing event rows stay.
DROP INDEX IF EXISTS "event_expiresAt_idx";

ALTER TABLE "event" DROP COLUMN "retentionDays";
ALTER TABLE "event" DROP COLUMN "expiresAt";
ALTER TABLE "event" DROP COLUMN "storagePurgedAt";

ALTER TABLE "platform_settings" DROP COLUMN "defaultRetentionDays";
