import { z } from "zod";
import { eventFontIds, resolveEventFontId, type EventFontId } from "@/lib/events/appearance";
import { POSTER_DATE_SIZE_MM, POSTER_PAGE_CQH_MM, POSTER_TITLE_MAX_MM } from "@/lib/events/poster-layout";

/** Full-page size of Design B’s “SHARE” line: 4.4cqh. */
export const POSTER_KICKER_SIZE_MM = Math.round(4.4 * POSTER_PAGE_CQH_MM * 100) / 100;

/** Full-page size of Design B’s script line: 8.4cqh. */
export const POSTER_SCRIPT_SIZE_MM = Math.round(8.4 * POSTER_PAGE_CQH_MM * 100) / 100;

export const posterSizeMinMm = 3;
export const posterSizeMaxMm = 28;

/** Camera width on the A8 card. Kept below the QR so the icon stays in the top corner. */
export const posterCameraMinMm = 6;
export const posterCameraMaxMm = 22;
export const POSTER_CAMERA_SIZE_MM = 16;

/** A8 card height. One cqh on that card is this many millimetres. */
const CARD_HEIGHT_MM = 52;

function sizeRange(min: number, max: number) {
  return z
    .number()
    .finite()
    .min(min)
    .max(max)
    .transform((value) => Math.round(value * 100) / 100);
}

const sizeMm = sizeRange(posterSizeMinMm, posterSizeMaxMm);
const cameraSizeMm = sizeRange(posterCameraMinMm, posterCameraMaxMm);

export const posterTypographySchema = z.strictObject({
  nameFont: z.enum(eventFontIds),
  nameSizeMm: sizeMm,
  dateFont: z.enum(eventFontIds),
  dateSizeMm: sizeMm,
  kickerFont: z.enum(eventFontIds),
  kickerSizeMm: sizeMm,
  scriptFont: z.enum(eventFontIds),
  scriptSizeMm: sizeMm,
  cameraSizeMm,
});

export type PosterTypography = z.infer<typeof posterTypographySchema>;

export type PosterTextSizes = {
  name: string;
  date: string;
  kicker: string;
  script: string;
};

export const defaultPosterTypography: PosterTypography = {
  nameFont: "alegreya",
  nameSizeMm: POSTER_TITLE_MAX_MM,
  dateFont: "noto-sans",
  dateSizeMm: POSTER_DATE_SIZE_MM,
  kickerFont: "noto-sans",
  kickerSizeMm: POSTER_KICKER_SIZE_MM,
  scriptFont: "mynerve",
  scriptSizeMm: POSTER_SCRIPT_SIZE_MM,
  cameraSizeMm: POSTER_CAMERA_SIZE_MM,
};

export function posterTypographyForTitle(titleFont: string): PosterTypography {
  return {
    ...defaultPosterTypography,
    nameFont: resolveEventFontId(titleFont),
  };
}

function storedRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function storedFont(value: unknown, fallback: EventFontId) {
  return typeof value === "string" ? resolveEventFontId(value) : fallback;
}

function storedSize(value: unknown, fallback: number, min = posterSizeMinMm, max = posterSizeMaxMm) {
  const size = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(size)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(size * 100) / 100));
}

/** Poster fonts are stored on the event. Missing values use the poster defaults, not the guest page. */
export function resolvePosterTypography(value: unknown): PosterTypography {
  const stored = storedRecord(value);
  const candidate = {
    nameFont: storedFont(stored.nameFont, defaultPosterTypography.nameFont),
    nameSizeMm: storedSize(stored.nameSizeMm, defaultPosterTypography.nameSizeMm),
    dateFont: storedFont(stored.dateFont, defaultPosterTypography.dateFont),
    dateSizeMm: storedSize(stored.dateSizeMm, defaultPosterTypography.dateSizeMm),
    kickerFont: storedFont(stored.kickerFont, defaultPosterTypography.kickerFont),
    kickerSizeMm: storedSize(stored.kickerSizeMm, defaultPosterTypography.kickerSizeMm),
    scriptFont: storedFont(stored.scriptFont, defaultPosterTypography.scriptFont),
    scriptSizeMm: storedSize(stored.scriptSizeMm, defaultPosterTypography.scriptSizeMm),
    cameraSizeMm: storedSize(
      stored.cameraSizeMm,
      defaultPosterTypography.cameraSizeMm,
      posterCameraMinMm,
      posterCameraMaxMm,
    ),
  };
  const parsed = posterTypographySchema.safeParse(candidate);

  return parsed.success ? parsed.data : defaultPosterTypography;
}

/** Size used on screen, in the PNG, and in print. Millimetres apply on a full A5 page; cqh scales the preview. */
export function posterFontSize(sizeMm: number) {
  const mm = Math.round(sizeMm * 1000) / 1000;
  const cqh = Math.round((mm / POSTER_PAGE_CQH_MM) * 1000) / 1000;
  return `min(${mm}mm, ${cqh}cqh)`;
}

/** Camera width on the A8 card. Millimetres apply at 52mm tall; cqh keeps the same proportion when the preview shrinks. */
export function posterCardSize(sizeMm: number) {
  const mm = Math.round(sizeMm * 1000) / 1000;
  const cqh = Math.round((mm / (CARD_HEIGHT_MM / 100)) * 1000) / 1000;
  return `min(${mm}mm, ${cqh}cqh)`;
}
