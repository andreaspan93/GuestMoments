import { inflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { A5_HEIGHT_PT, A5_WIDTH_PT, buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";
import { defaultPosterTypography } from "@/lib/events/poster-typography";
import { sharePosterCopy } from "@/lib/events/qr-design";
import { buildSharePosterPdf } from "@/lib/events/share-poster-pdf";

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

async function pageSize(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);

  return {
    pages: pdf.getPageCount(),
    size: pdf.getPage(0).getSize(),
  };
}

describe("Design B A5 poster", () => {
  it("uses the same A5 page as Design A and a different layout", async () => {
    const qr = { bytes: png };
    const designA = await buildPosterPdf({
      name: "Wedding day",
      dateLabel: "24 Jun 2026",
      cta: posterCta("en"),
      locale: "en",
      logoSize: "medium",
      logoCorner: "square",
      qr,
    });
    const designB = await buildSharePosterPdf({
      name: "Ανδρέας και Μαρία",
      dateLabel: "24. 06. 2026",
      ...sharePosterCopy("el"),
      qr,
    });
    const page = await pageSize(designB);

    expect(page.pages).toBe(1);
    expect(page.size.width).toBeCloseTo(A5_WIDTH_PT, 2);
    expect(page.size.height).toBeCloseTo(A5_HEIGHT_PT, 2);
    expect(Buffer.from(designB).equals(Buffer.from(designA))).toBe(false);
    expect(Buffer.from(designB).toString("latin1")).not.toContain("Chrissy");
    expect(Buffer.from(designB).toString("latin1")).not.toContain("Thomas");
  });

  it("uses the saved poster fonts for the name, date, SHARE line, and script line", async () => {
    const qr = { bytes: png };
    const copy = sharePosterCopy("en");
    const base = {
      name: "Wedding day",
      dateLabel: "06. 24. 2026",
      ...copy,
      qr,
    };
    const original = await buildSharePosterPdf({ ...base, name: "Wedding day", typography: defaultPosterTypography });
    const custom = await buildSharePosterPdf({
      ...base,
      name: "Wedding day",
      typography: {
        nameFont: "playpen-sans",
        nameSizeMm: 11,
        dateFont: "eb-garamond",
        dateSizeMm: 5,
        kickerFont: "literata",
        kickerSizeMm: 8,
        scriptFont: "alegreya",
        scriptSizeMm: 14,
        cameraSizeMm: 16,
      },
    });
    const customPdf = await PDFDocument.load(custom);
    const fonts = embeddedFontNames(customPdf);

    expect(Buffer.from(custom).equals(Buffer.from(original))).toBe(false);
    expect(fonts).toContain("PlaypenSans");
    expect(fonts).toContain("EBGaramond");
    expect(fonts).toContain("Literata");
    expect(fonts).toContain("Alegreya");
    expect((await pageSize(custom)).pages).toBe(1);
  });

  it("draws SHARE as one tracked line instead of one clipped glyph at a time", async () => {
    const bytes = await buildSharePosterPdf({
      name: "Wedding day",
      dateLabel: "06. 24. 2026",
      ...sharePosterCopy("en"),
      qr: { bytes: png },
      typography: defaultPosterTypography,
    });
    const content = await contentStream(bytes);
    const share = content.match(/BT[\s\S]*?ET/);
    const glyphs = share?.[0].match(/<[0-9A-F]{4}>/g) ?? [];

    expect(glyphs).toHaveLength(5);
    expect(share?.[0]).toMatch(/\] TJ/);
    expect(share?.[0]).not.toMatch(/\bTc\b/);
    expect(share?.[0]).toContain("<0003>");
    expect(await shareGlyphHasInk(bytes)).toBe(true);
  });
});

async function contentStream(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const contents = pdf.getPage(0).node.Contents();
  const array = pdf.context.lookup(contents) as unknown as {
    size: () => number;
    get: (index: number) => unknown;
  };
  const parts: string[] = [];

  for (let index = 0; index < array.size(); index += 1) {
    const stream = pdf.context.lookup(array.get(index) as never) as unknown as {
      getContents: () => Uint8Array;
    };
    parts.push(inflateSync(Buffer.from(stream.getContents())).toString("latin1"));
  }

  return parts.join("\n");
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

async function shareGlyphHasInk(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const resources = pdf.getPage(0).node.normalizedEntries().Resources;
  const fonts = resources.entries().find(([key]) => String(key) === "/Font")?.[1];
  const dict = entryRecord(fonts) ?? entryRecord(pdf.context.lookup(fonts as never));

  if (!dict) {
    return false;
  }

  for (const [, value] of dict.entries()) {
    const font = entryRecord(value) ?? entryRecord(pdf.context.lookup(value as never));
    const base = String(font?.entries().find(([key]) => String(key) === "/BaseFont")?.[1] ?? "");

    if (!base.includes("NotoSans-SemiBold")) {
      continue;
    }

    const cmapRef = font?.entries().find(([key]) => String(key) === "/ToUnicode")?.[1];
    const cmapStream = pdf.context.lookup(cmapRef as never) as unknown as { getContents: () => Uint8Array };
    const cmap = inflateSync(Buffer.from(cmapStream.getContents())).toString("latin1");

    if (!cmap.includes("<0001> <0053>") || !cmap.includes("<0003> <0041>")) {
      continue;
    }

    const descendants = font?.entries().find(([key]) => String(key) === "/DescendantFonts")?.[1];
    const list = pdf.context.lookup(descendants as never) as unknown as { get: (index: number) => unknown };
    const cid = entryRecord(pdf.context.lookup(list.get(0) as never));
    const descriptorRef = cid?.entries().find(([key]) => String(key) === "/FontDescriptor")?.[1];
    const descriptor = entryRecord(pdf.context.lookup(descriptorRef as never));
    const fileRef = descriptor?.entries().find(([key]) => String(key) === "/FontFile2")?.[1];
    const file = pdf.context.lookup(fileRef as never) as unknown as { getContents: () => Uint8Array };
    const face = fontkit.create(inflateSync(Buffer.from(file.getContents()))) as unknown as {
      getGlyph: (index: number) => { path: { commands: unknown[] } };
    };

    return face.getGlyph(3).path.commands.length > 0;
  }

  return false;
}

function entryRecord(value: unknown): { entries: () => Array<[unknown, unknown]> } | null {
  if (value && typeof value === "object" && "entries" in value && typeof value.entries === "function") {
    return value as { entries: () => Array<[unknown, unknown]> };
  }

  return null;
}
