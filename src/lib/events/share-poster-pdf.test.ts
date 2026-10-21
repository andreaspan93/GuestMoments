import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { A5_HEIGHT_PT, A5_WIDTH_PT, buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";
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
});
