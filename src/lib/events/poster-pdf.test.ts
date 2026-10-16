import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { A5_HEIGHT_PT, A5_WIDTH_PT, buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";

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
});
