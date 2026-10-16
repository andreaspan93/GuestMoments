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
  posterContentWidthPt,
  posterCta,
  posterTitleSizePt,
} from "@/lib/events/poster-pdf";
import { posterTitleRuns, titleFontFile } from "@/lib/events/poster-title";

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
