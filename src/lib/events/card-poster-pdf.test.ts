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
});
