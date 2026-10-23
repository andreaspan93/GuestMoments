import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildCardPosterPdf } from "@/lib/events/card-poster-pdf";
import { A8_LANDSCAPE_HEIGHT_PT, A8_LANDSCAPE_WIDTH_PT } from "@/lib/events/poster-paper";
import { defaultPosterTypography } from "@/lib/events/poster-typography";
import { sharePosterCopy } from "@/lib/events/qr-design";

const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

describe("Design C landscape A8 poster", () => {
  it("uses one landscape A8 page", async () => {
    const bytes = await buildCardPosterPdf({
      name: "Sarah and Mark",
      dateLabel: "06. 24. 2026",
      ...sharePosterCopy("en"),
      qr: { bytes: png },
      typography: defaultPosterTypography,
    });
    const pdf = await PDFDocument.load(bytes);
    const page = pdf.getPage(0);
    const size = page.getSize();

    expect(pdf.getPageCount()).toBe(1);
    expect(size.width).toBeCloseTo(A8_LANDSCAPE_WIDTH_PT, 2);
    expect(size.height).toBeCloseTo(A8_LANDSCAPE_HEIGHT_PT, 2);
    expect(size.width).toBeGreaterThan(size.height);
    expect(A8_LANDSCAPE_WIDTH_PT).toBeCloseTo((74 * 72) / 25.4, 2);
    expect(A8_LANDSCAPE_HEIGHT_PT).toBeCloseTo((52 * 72) / 25.4, 2);
  });

  it("draws the camera at the saved card width", async () => {
    const small = await buildCardPosterPdf({
      name: "Sarah and Mark",
      dateLabel: "06. 24. 2026",
      ...sharePosterCopy("en"),
      qr: { bytes: png },
      typography: { ...defaultPosterTypography, cameraSizeMm: 10 },
    });
    const large = await buildCardPosterPdf({
      name: "Sarah and Mark",
      dateLabel: "06. 24. 2026",
      ...sharePosterCopy("en"),
      qr: { bytes: png },
      typography: { ...defaultPosterTypography, cameraSizeMm: 20 },
    });

    expect(await cameraWidth(small)).toBeCloseTo((10 * 72) / 25.4, 1);
    expect(await cameraWidth(large)).toBeCloseTo((20 * 72) / 25.4, 1);
  });
});

async function cameraWidth(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const contents = pdf.getPage(0).node.Contents();
  const array = pdf.context.lookup(contents) as unknown as { size: () => number; get: (index: number) => unknown };
  const parts: string[] = [];

  for (let index = 0; index < array.size(); index += 1) {
    const stream = pdf.context.lookup(array.get(index) as never) as unknown as { getContents: () => Uint8Array };
    parts.push(inflateSync(Buffer.from(stream.getContents())).toString("latin1"));
  }

  const drawn = [...parts.join("\n").matchAll(/([\d.]+) 0 0 ([\d.]+) [\d.]+ [\d.]+ cm/g)].map((match) => ({
    width: Number(match[1]),
    height: Number(match[2]),
  }));
  const camera = drawn.find((image) => image.width > 5 && image.width !== image.height);

  return camera?.width ?? 0;
}
