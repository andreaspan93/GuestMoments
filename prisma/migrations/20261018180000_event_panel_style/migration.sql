-- Guest-page card style. Existing events stay on the opaque cream cards.
ALTER TABLE "event" ADD COLUMN "panelStyle" TEXT NOT NULL DEFAULT 'solid';
