import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { isEventFontId, type EventFontId } from "@/lib/events/appearance";
import { POSTER_PAGE_CQH_MM, POSTER_TITLE_MAX_MM } from "@/lib/events/poster-layout";

export { POSTER_TITLE_MAX_MM };

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
  "great-vibes": "GreatVibes-Regular.ttf",
  allura: "Allura-Regular.ttf",
  "playfair-display": "PlayfairDisplay-SemiBold.ttf",
  "cormorant-garamond": "CormorantGaramond-SemiBold.ttf",
  montserrat: "Montserrat-SemiBold.ttf",
  parisienne: "Parisienne-Regular.ttf",
  "pinyon-script": "PinyonScript-Regular.ttf",
  cinzel: "Cinzel-SemiBold.ttf",
  "dm-serif-display": "DMSerifDisplay-Regular.ttf",
  "libre-baskerville": "LibreBaskerville-Bold.ttf",
};

const serifFallback = new Set<EventFontId>([
  "noto-serif",
  "literata",
  "eb-garamond",
  "playfair-display",
  "cormorant-garamond",
  "great-vibes",
  "allura",
  "parisienne",
  "pinyon-script",
  "cinzel",
  "dm-serif-display",
  "libre-baskerville",
]);

type LayoutFont = {
  unitsPerEm: number;
  layout: (text: string) => {
    advanceWidth: number;
    glyphs: Array<{ id: number; name?: string }>;
  };
};

export type PosterTitleRun = {
  fontId: EventFontId;
  text: string;
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

function fallbackFont(titleFont: EventFontId): EventFontId {
  if (titleFont === "noto-serif") {
    return "noto-sans";
  }

  return serifFallback.has(titleFont) ? "noto-serif" : "noto-sans";
}

function hasGlyph(font: LayoutFont, character: string) {
  const glyph = font.layout(character).glyphs[0];
  return Boolean(glyph && glyph.id !== 0 && glyph.name !== ".notdef");
}

export function posterTitleRuns(name: string, titleFont = "noto-sans"): PosterTitleRun[] {
  const text = posterTitleText(name);
  const primaryId: EventFontId = isEventFontId(titleFont) ? titleFont : "noto-sans";
  const fallbackId = fallbackFont(primaryId);
  const primary = layoutFont(primaryId);
  const runs: PosterTitleRun[] = [];
  let chunk = "";
  let chunkFont = primaryId;

  for (const character of Array.from(text)) {
    if (character.trim() === "") {
      chunk += character;
      continue;
    }

    const fontId = hasGlyph(primary, character) ? primaryId : fallbackId;

    if (chunk.trim() && fontId !== chunkFont) {
      runs.push({ fontId: chunkFont, text: chunk });
      chunk = character;
      chunkFont = fontId;
      continue;
    }

    if (!chunk.trim()) {
      chunkFont = fontId;
    }

    chunk += character;
  }

  if (chunk) {
    runs.push({ fontId: chunkFont, text: chunk });
  }

  return runs;
}

function runWidthMm(run: PosterTitleRun, sizeMm: number) {
  const font = layoutFont(run.fontId);
  return (font.layout(run.text).advanceWidth / font.unitsPerEm) * sizeMm;
}

export function posterTitleWidthMm(name: string, titleFont: string, sizeMm: number) {
  if (!posterTitleText(name) || sizeMm <= 0) {
    return 0;
  }

  return posterTitleRuns(name, titleFont).reduce((sum, run) => sum + runWidthMm(run, sizeMm), 0);
}

export function fittedTitleSizeMm(name: string, titleFont = "noto-sans", maxMm = POSTER_TITLE_MAX_MM) {
  const widthAtMax = posterTitleWidthMm(name, titleFont, maxMm);

  if (widthAtMax <= POSTER_TITLE_WIDTH_MM) {
    return maxMm;
  }

  return (maxMm * POSTER_TITLE_WIDTH_MM * TITLE_FIT) / widthAtMax;
}

export function posterTitleSize(name: string, titleFont = "noto-sans") {
  const sizeMm = fittedTitleSizeMm(name, titleFont);
  const cqh = Math.round((sizeMm / POSTER_PAGE_CQH_MM) * 1000) / 1000;
  return `${cqh}cqh`;
}
