import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { isEventFontId, type EventFontId } from "@/lib/events/appearance";

/** Largest poster title, matching the short-name size of 5.6cqh on an A5 page. */
export const POSTER_TITLE_MAX_MM = 5.6 * 2.1;

/** Width inside the poster’s 11mm side padding. */
export const POSTER_TITLE_WIDTH_MM = 148 - 11 * 2;

const TITLE_FIT = 0.96;

const titleFontFiles: Record<EventFontId, string> = {
  "noto-sans": "NotoSans-SemiBold.ttf",
  "noto-serif": "NotoSerif-SemiBold.ttf",
  "source-sans": "SourceSans3-Semibold.ttf",
  "alegreya-sans": "AlegreyaSans-Bold.ttf",
  literata: "Literata-SemiBold.ttf",
  "eb-garamond": "EBGaramond-SemiBold.ttf",
};

type LayoutFont = {
  unitsPerEm: number;
  layout: (text: string) => { advanceWidth: number };
};

const fontCache = new Map<string, LayoutFont>();

export function titleFontFile(titleFont: string) {
  const id: EventFontId = isEventFontId(titleFont) ? titleFont : "noto-sans";
  return titleFontFiles[id];
}

function layoutFont(titleFont: string) {
  const fileName = titleFontFile(titleFont);
  const cached = fontCache.get(fileName);

  if (cached) {
    return cached;
  }

  const loaded = fontkit.create(
    readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName)),
  ) as LayoutFont;
  fontCache.set(fileName, loaded);
  return loaded;
}

export function posterTitleText(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

export function posterTitleWidthMm(name: string, titleFont: string, sizeMm: number) {
  const text = posterTitleText(name);

  if (!text || sizeMm <= 0) {
    return 0;
  }

  const font = layoutFont(titleFont);
  return (font.layout(text).advanceWidth / font.unitsPerEm) * sizeMm;
}

export function fittedTitleSizeMm(name: string, titleFont = "noto-sans") {
  const widthAtMax = posterTitleWidthMm(name, titleFont, POSTER_TITLE_MAX_MM);

  if (widthAtMax <= POSTER_TITLE_WIDTH_MM) {
    return POSTER_TITLE_MAX_MM;
  }

  return (POSTER_TITLE_MAX_MM * POSTER_TITLE_WIDTH_MM * TITLE_FIT) / widthAtMax;
}

export function posterTitleSize(name: string, titleFont = "noto-sans") {
  const sizeMm = fittedTitleSizeMm(name, titleFont);

  if (Math.abs(sizeMm - POSTER_TITLE_MAX_MM) < 0.001) {
    return "5.6cqh";
  }

  const cqh = Math.floor((sizeMm / 2.1) * 1000) / 1000;
  return `${cqh}cqh`;
}
