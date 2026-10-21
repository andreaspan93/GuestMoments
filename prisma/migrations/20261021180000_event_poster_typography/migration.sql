-- Poster typography is independent of the guest-page fonts.
-- Existing events keep the event-name font the poster already used.
ALTER TABLE "event" ADD COLUMN "posterTypography" JSONB;

UPDATE "event"
SET "posterTypography" = jsonb_build_object(
  'nameFont', "titleFont",
  'nameSizeMm', 16.8,
  'dateFont', 'noto-sans',
  'dateSizeMm', 6.2,
  'kickerFont', 'noto-sans',
  'kickerSizeMm', 9.24,
  'scriptFont', 'mynerve',
  'scriptSizeMm', 17.64
)
WHERE "posterTypography" IS NULL;
