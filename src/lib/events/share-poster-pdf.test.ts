import { inflateSync } from "node:zlib";
import fontkit from "@pdf-lib/fontkit";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { eventFontIds } from "@/lib/events/appearance";
import { buildCardPosterPdf } from "@/lib/events/card-poster-pdf";
import { A5_HEIGHT_PT, A5_WIDTH_PT, buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";
import { defaultPosterTypography, type PosterTypography } from "@/lib/events/poster-typography";
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
    expect(await shareLetters(bytes)).toBe("SHARE");
    expect((await paintedText(bytes)).blanks).toEqual([]);
  });

  it("paints every Greek and English letter for each poster font", async () => {
    const qr = { bytes: png };
    const greek = {
      name: "Ανδρέας & Ιωάννα",
      dateLabel: "31. 10. 2025",
      ...sharePosterCopy("el"),
    };
    const english = {
      name: "Andreas & Ioanna",
      dateLabel: "10. 31. 2025",
      ...sharePosterCopy("en"),
    };
    const didot = posterFonts("gfs-didot", "mynerve");
    const playpen = posterFonts("playpen-sans", "playpen-sans");

    await expectPainted(await buildSharePosterPdf({ ...greek, qr, typography: didot }), Object.values(greek).join(""));
    await expectPainted(await buildSharePosterPdf({ ...english, qr, typography: didot }), `${english.name}${english.dateLabel}${english.kicker}${english.line1}${english.line2}`);
    await expectPainted(
      await buildCardPosterPdf({ ...greek, qr, typography: didot }),
      `${greek.kicker}${greek.script}${greek.name}${greek.dateLabel}${greek.line2}`,
    );
    await expectPainted(
      await buildPosterPdf({
        name: greek.name,
        titleFont: "gfs-didot",
        dateFont: "gfs-didot",
        dateLabel: greek.dateLabel,
        cta: posterCta("el"),
        locale: "el",
        logoSize: "medium",
        logoCorner: "square",
        qr,
      }),
      `${greek.name}${greek.dateLabel}${posterCta("el").toLocaleUpperCase("el")}`,
    );
    await expectPainted(await buildSharePosterPdf({ ...greek, qr, typography: playpen }));
    await expectPainted(await buildSharePosterPdf({ ...english, qr, typography: playpen }));

    for (const fontId of eventFontIds) {
      const typography = posterFonts(fontId, fontId);
      await expectPainted(await buildSharePosterPdf({ ...greek, qr, typography }));
      await expectPainted(await buildSharePosterPdf({ ...english, qr, typography }));
    }
  }, 180000);
});

function posterFonts(fontId: string, scriptFont: string): PosterTypography {
  return {
    nameFont: fontId,
    nameSizeMm: 10,
    dateFont: fontId,
    dateSizeMm: 6,
    kickerFont: fontId,
    kickerSizeMm: 10,
    scriptFont,
    scriptSizeMm: 16,
    cameraSizeMm: 16,
  };
}

async function expectPainted(bytes: Uint8Array, expected = "") {
  const painted = await paintedText(bytes);
  const missing = visibleCharacters(expected).filter((character) => !painted.characters.includes(character));

  expect(painted.blanks, painted.blanks.join(" ")).toEqual([]);
  expect(missing, missing.join(" ")).toEqual([]);
}

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

async function shareLetters(bytes: Uint8Array) {
  const content = await contentStream(bytes);
  const share = content.match(/BT[\s\S]*?ET/)?.[0] ?? "";
  const name = share.match(/\/([^\s]+)\s+[\d.]+\s+Tf/)?.[1] ?? "";
  const painted = await paintedText(bytes);
  return glyphIds(share).map((id) => painted.byGlyph.get(`${name}:${id}`) ?? "").join("");
}

function visibleCharacters(value: string) {
  return Array.from(new Set(Array.from(value).filter((character) => character.trim() !== "")));
}

function glyphIds(value: string) {
  const ids: string[] = [];

  for (const token of value.match(/<([0-9A-F]+)>/gi) ?? []) {
    const hex = token.slice(1, -1);
    for (let index = 0; index < hex.length; index += 4) {
      ids.push(hex.slice(index, index + 4).toUpperCase());
    }
  }

  return ids;
}

async function paintedText(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const content = await contentStream(bytes);
  const resources = pdf.getPage(0).node.normalizedEntries().Resources;
  const fonts = resources.entries().find(([key]) => String(key) === "/Font")?.[1];
  const dict = entryRecord(fonts) ?? entryRecord(pdf.context.lookup(fonts as never));
  const characters: string[] = [];
  const blanks: string[] = [];
  const byGlyph = new Map<string, string>();

  if (!dict) {
    return { characters: "", blanks, byGlyph };
  }

  for (const [key, value] of dict.entries()) {
    const font = entryRecord(value) ?? entryRecord(pdf.context.lookup(value as never));
    const name = String(key).replace(/^\//, "");
    const used = new Set(glyphIds(sectionsForFont(content, name).join("\n")));
    const cmap = unicodeByGlyph(fontStream(pdf, font, "ToUnicode"));
    const face = fontkit.create(fontStream(pdf, font, "FontFile2")) as unknown as {
      getGlyph: (index: number) => { path: { commands: unknown[] } };
    };

    for (const id of used) {
      const text = cmap.get(id) ?? "";
      if (!text.trim()) {
        continue;
      }

      byGlyph.set(`${name}:${id}`, text);
      let commands = 0;
      try {
        commands = face.getGlyph(Number.parseInt(id, 16)).path.commands.length;
      } catch {
        commands = 0;
      }

      if (commands > 0) {
        characters.push(text);
      } else {
        blanks.push(text);
      }
    }
  }

  return { characters: characters.join(""), blanks, byGlyph };
}

function sectionsForFont(content: string, name: string) {
  return content.split(/(?=\/[^\s]+\s+[\d.]+\s+Tf)/).filter((section) => section.includes(`/${name} `));
}

function unicodeByGlyph(cmap: Uint8Array) {
  const text = inflateSync(Buffer.from(cmap)).toString("latin1");
  const map = new Map<string, string>();

  for (const match of text.matchAll(/<([0-9A-F]{4})>\s*<([0-9A-F]+)>/gi)) {
    const characters = match[2].match(/.{4}/g)?.map((hex) => String.fromCharCode(Number.parseInt(hex, 16))).join("") ?? "";
    map.set(match[1].toUpperCase(), characters);
  }

  return map;
}

function fontStream(pdf: PDFDocument, font: { entries: () => Array<[unknown, unknown]> } | null, kind: "ToUnicode" | "FontFile2") {
  if (kind === "ToUnicode") {
    const cmapRef = font?.entries().find(([key]) => String(key) === "/ToUnicode")?.[1];
    const stream = pdf.context.lookup(cmapRef as never) as unknown as { getContents: () => Uint8Array };
    return stream.getContents();
  }

  const descendants = font?.entries().find(([key]) => String(key) === "/DescendantFonts")?.[1];
  const list = pdf.context.lookup(descendants as never) as unknown as { get: (index: number) => unknown };
  const cid = entryRecord(pdf.context.lookup(list.get(0) as never));
  const descriptorRef = cid?.entries().find(([key]) => String(key) === "/FontDescriptor")?.[1];
  const descriptor = entryRecord(pdf.context.lookup(descriptorRef as never));
  const fileRef = descriptor?.entries().find(([key]) => String(key) === "/FontFile2")?.[1];
  const file = pdf.context.lookup(fileRef as never) as unknown as { getContents: () => Uint8Array };
  return inflateSync(Buffer.from(file.getContents()));
}

function entryRecord(value: unknown): { entries: () => Array<[unknown, unknown]> } | null {
  if (value && typeof value === "object" && "entries" in value && typeof value.entries === "function") {
    return value as { entries: () => Array<[unknown, unknown]> };
  }

  return null;
}
