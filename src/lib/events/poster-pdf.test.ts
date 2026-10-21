import { inflateSync } from "node:zlib";
import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { eventFontIds } from "@/lib/events/appearance";
import {
  A5_HEIGHT_PT,
  A5_WIDTH_PT,
  buildPosterPdf,
  PDF_DATE_SIZE_MM,
  PDF_TITLE_MAX_MM,
  posterContentTop,
  posterContentWidthPt,
  posterCta,
  posterTitleSizePt,
} from "@/lib/events/poster-pdf";
import { POSTER_DATE_GAP_MM, POSTER_PHOTO_GAP_MM } from "@/lib/events/poster-layout";
import { POSTER_TITLE_WIDTH_MM, posterTitleRuns, posterTitleWidthMm, titleFontFile } from "@/lib/events/poster-title";

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

const longName = "Ανδρέας και Μαρία γιορτάζουν μια πολύ μεγάλη μέρα με την οικογένεια και τους φίλους τους στο νησί";

async function pageSize(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);

  return {
    pages: pdf.getPageCount(),
    size: pdf.getPage(0).getSize(),
  };
}

describe("A5 poster pdf", () => {
  it("uses one exact A5 portrait page for the poster content", async () => {
    const bytes = await buildPosterPdf({
      name: "Andreas wed",
      dateLabel: "15 Oct 2026",
      cta: posterCta("en"),
      locale: "en",
      logoSize: "medium",
      logoCorner: "rounded",
      logo: { bytes: png },
      qr: { bytes: png },
    });
    const page = await pageSize(bytes);

    expect(page.pages).toBe(1);
    expect(page.size.width).toBeCloseTo(A5_WIDTH_PT, 2);
    expect(page.size.height).toBeCloseTo(A5_HEIGHT_PT, 2);
    expect(Buffer.from(bytes).toString("latin1")).not.toContain("Print");
  });

  it("places a larger title higher and keeps a slightly smaller date on one line", async () => {
    const short = await buildPosterPdf({
      name: "Wedding",
      dateLabel: "15 Oct 2026",
      cta: posterCta("en"),
      locale: "en",
      logoSize: "medium",
      logoCorner: "square",
      qr: { bytes: png },
    });
    const long = await buildPosterPdf({
      name: longName,
      titleFont: "playfair-display",
      dateLabel: "15 Οκτ 2026",
      cta: posterCta("el"),
      locale: "el",
      logoSize: "extra-large",
      logoCorner: "rounded",
      cover: { bytes: png },
      logo: { bytes: png },
      qr: { bytes: png },
    });
    const shortPdf = await PDFDocument.load(short);
    const longPdf = await PDFDocument.load(long);
    const shortSizes = textSizesMm(shortPdf);
    const longSizes = textSizesMm(longPdf);
    const padTop = (11 * 72) / 25.4;
    const padBottom = (12 * 72) / 25.4;
    const contentHeight = A5_HEIGHT_PT - padTop - padBottom;
    const centeredTop = A5_HEIGHT_PT - padTop - (contentHeight - 220) / 2;

    expect(shortPdf.getPageCount()).toBe(1);
    expect(longPdf.getPageCount()).toBe(1);
    expect(shortPdf.getPage(0).getSize().width).toBeCloseTo(A5_WIDTH_PT, 2);
    expect(shortPdf.getPage(0).getSize().height).toBeCloseTo(A5_HEIGHT_PT, 2);
    expect(shortSizes[0]).toBeCloseTo(PDF_TITLE_MAX_MM, 1);
    expect(shortSizes[1]).toBeCloseTo(PDF_DATE_SIZE_MM, 1);
    expect(longSizes[0]).toBeLessThan(shortSizes[0]);
    expect(longSizes[0]).toBeGreaterThan(0);
    expect(posterTitleWidthMm("Wedding", "noto-sans", shortSizes[0])).toBeLessThanOrEqual(POSTER_TITLE_WIDTH_MM);
    expect(posterTitleWidthMm(longName, "playfair-display", longSizes[0])).toBeLessThanOrEqual(
      POSTER_TITLE_WIDTH_MM + 0.2,
    );
    expect(titleShows(shortPdf)).toBe(1);
    expect(titleShows(longPdf)).toBe(1);
    expect(posterContentTop(220)).toBeGreaterThan(centeredTop);
    expect(posterContentWidthPt).toBeGreaterThan(0);
  });

  it("prints the saved poster name and date fonts at the saved sizes", async () => {
    const bytes = await buildPosterPdf({
      name: "Wedding",
      titleFont: "literata",
      nameSizeMm: 10,
      dateFont: "mynerve",
      dateSizeMm: 4,
      dateLabel: "15 Oct 2026",
      cta: posterCta("en"),
      locale: "en",
      logoSize: "medium",
      logoCorner: "square",
      qr: { bytes: png },
    });
    const pdf = await PDFDocument.load(bytes);
    const sizes = textSizesMm(pdf);

    expect(sizes[0]).toBeCloseTo(10, 1);
    expect(sizes[1]).toBeCloseTo(4, 1);
    expect(embeddedFontNames(pdf)).toContain("Literata-SemiBold");
    expect(embeddedFontNames(pdf)).toContain("Mynerve-Regular");
  });

  it("keeps the title high, moves the date down a little, and places the photo below the date", async () => {
    const bytes = await buildPosterPdf({
      name: "Wedding",
      dateLabel: "15 Oct 2026",
      cta: posterCta("en"),
      locale: "en",
      logoSize: "medium",
      logoCorner: "square",
      cover: { bytes: png },
      qr: { bytes: png },
    });
    const pdf = await PDFDocument.load(bytes);
    const content = pageContent(pdf);
    const baselines = [...content.matchAll(/1 0 0 1 [\d.]+ ([\d.]+) Tm/g)].map((match) => Number(match[1]));
    const images = [
      ...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) cm\s+1 0 0 1 0 0 cm\s+([\d.]+) 0 0 ([\d.]+) 0 0 cm/g),
    ]
      .map((match) => ({
        width: (Number(match[3]) * 25.4) / 72,
        height: (Number(match[4]) * 25.4) / 72,
        top: ((Number(match[2]) + Number(match[4])) * 25.4) / 72,
        bottom: (Number(match[2]) * 25.4) / 72,
      }))
      .filter((image) => image.width > 2);
    const titleY = (baselines[0] * 25.4) / 72;
    const dateY = (baselines[1] * 25.4) / 72;
    const cover = images.reduce((largest, image) => (image.height > largest.height ? image : largest));
    const page = pdf.getPage(0).getSize();

    expect(pdf.getPageCount()).toBe(1);
    expect(titleY).toBeGreaterThan(dateY);
    expect(titleY - dateY).toBeGreaterThan(PDF_DATE_SIZE_MM + POSTER_DATE_GAP_MM);
    expect(titleY - dateY).toBeLessThan(PDF_DATE_SIZE_MM + POSTER_DATE_GAP_MM + 4);
    expect(dateY).toBeGreaterThan(cover.top);
    expect(dateY - cover.top).toBeGreaterThan(POSTER_PHOTO_GAP_MM);
    expect(cover.bottom).toBeGreaterThan(10);
    expect(cover.top).toBeLessThan((page.height * 25.4) / 72);
    for (const image of images) {
      expect(image.bottom).toBeGreaterThan(0);
      expect(image.top).toBeLessThan((page.height * 25.4) / 72);
    }
  });

  it("keeps long names, Greek text, and every logo size on one page", async () => {
    for (const logoSize of ["small", "medium", "large", "extra-large"] as const) {
      for (const logoCorner of ["square", "rounded"] as const) {
        const bytes = await buildPosterPdf({
          name: longName,
          dateLabel: "15 Οκτ 2026",
          cta: posterCta("el"),
          locale: "el",
          logoSize,
          logoCorner,
          cover: { bytes: png },
          logo: { bytes: png },
          qr: { bytes: png },
        });
        const page = await pageSize(bytes);

        expect(page.pages).toBe(1);
        expect(page.size.width).toBeCloseTo(A5_WIDTH_PT, 2);
        expect(page.size.height).toBeCloseTo(A5_HEIGHT_PT, 2);
      }
    }
  });

  it("draws a short title, a long Greek title, and every saved title font on one line", async () => {
    const names = ["Andreas wed", longName, "Ω".repeat(120)];

    for (const titleFont of eventFontIds) {
      for (const name of names) {
        const bytes = await buildPosterPdf({
          name,
          titleFont,
          dateLabel: "15 Οκτ 2026",
          cta: posterCta("el"),
          locale: "el",
          logoSize: "extra-large",
          logoCorner: "square",
          cover: { bytes: png },
          logo: { bytes: png },
          qr: { bytes: png },
        });
        const page = await pageSize(bytes);
        const title = await measuredTitle(name, titleFont);

        expect(page.pages).toBe(1);
        expect(page.size.width).toBeCloseTo(A5_WIDTH_PT, 2);
        expect(page.size.height).toBeCloseTo(A5_HEIGHT_PT, 2);
        const pdf = await PDFDocument.load(bytes);

        expect(title.width).toBeLessThanOrEqual(posterContentWidthPt + 0.05);
        expect(titleShows(pdf)).toBe(1);
        const usedFont = posterTitleRuns(name, titleFont)[0]?.fontId ?? titleFont;
        expect(embeddedFontNames(pdf)).toContain(titleFontFile(usedFont).replace(".ttf", ""));
      }
    }
  }, 60000);
});

async function measuredTitle(name: string, titleFont: string) {
  const runs = posterTitleRuns(name, titleFont);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const faces = new Map<string, Awaited<ReturnType<PDFDocument["embedFont"]>>>();

  for (const run of runs) {
    const fileName = titleFontFile(run.fontId);

    if (!faces.has(fileName)) {
      faces.set(
        fileName,
        await pdf.embedFont(readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName)), {
          subset: true,
        }),
      );
    }
  }

  const widthAt = (size: number) =>
    runs.reduce((sum, run) => sum + (faces.get(titleFontFile(run.fontId))?.widthOfTextAtSize(run.text, size) ?? 0), 0);
  const size = posterTitleSizePt(widthAt, name, titleFont);

  return {
    size,
    width: widthAt(size),
  };
}

function pageContent(pdf: PDFDocument) {
  const contents = pdf.getPage(0).node.Contents();
  const refs = contents && "asArray" in contents ? contents.asArray() : [contents];
  let text = "";

  for (const ref of refs) {
    if (!ref) {
      continue;
    }

    const stream = pdf.context.lookup(ref) as { getContents?: () => Uint8Array };
    const raw = stream.getContents?.();

    if (!raw) {
      continue;
    }

    try {
      text += inflateSync(raw).toString("latin1");
    } catch {
      text += Buffer.from(raw).toString("latin1");
    }
  }

  return text;
}

function textSizesMm(pdf: PDFDocument) {
  return [...pageContent(pdf).matchAll(/([\d.]+) Tf/g)].map((match) => (Number(match[1]) * 25.4) / 72);
}

function titleShows(pdf: PDFDocument) {
  const content = pageContent(pdf).match(/[\d.]+ Tf[\s\S]*?(?=[\d.]+ Tf)/);

  return content ? (content[0].match(/Tj/g) ?? []).length : 0;
}

type EntryRecord = {
  entries: () => Array<[unknown, unknown]>;
};

function entryRecord(value: unknown): EntryRecord | null {
  if (value && typeof value === "object" && "entries" in value && typeof value.entries === "function") {
    return value as EntryRecord;
  }

  return null;
}

function embeddedFontNames(pdf: PDFDocument) {
  const resources = pdf.getPage(0).node.normalizedEntries().Resources;
  const fonts = resources.entries().find(([key]) => String(key) === "/Font")?.[1];
  const dict = entryRecord(fonts) ?? entryRecord(pdf.context.lookup(fonts as never));
  const names: string[] = [];

  if (!dict) {
    return "";
  }

  for (const [, value] of dict.entries()) {
    const font = entryRecord(value) ?? entryRecord(pdf.context.lookup(value as never));
    const base = font?.entries().find(([key]) => String(key) === "/BaseFont")?.[1];
    names.push(String(base ?? ""));
  }

  return names.join(" ");
}
