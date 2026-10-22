import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { A5_HEIGHT_PT, A5_WIDTH_PT } from "@/lib/events/poster-pdf";
import { A7_HEIGHT_PT, A7_WIDTH_PT, fitPosterPdfToA7 } from "@/lib/events/poster-paper";

describe("A7 poster paper", () => {
  it("scales an A5 poster page onto an A7 page", async () => {
    const source = await PDFDocument.create();
    const sourcePage = source.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]);
    sourcePage.drawRectangle({ x: 0, y: 0, width: A5_WIDTH_PT, height: A5_HEIGHT_PT });
    const fitted = await PDFDocument.load(await fitPosterPdfToA7(await source.save()));
    const page = fitted.getPage(0);

    expect(page.getSize().width).toBeCloseTo(A7_WIDTH_PT, 2);
    expect(page.getSize().height).toBeCloseTo(A7_HEIGHT_PT, 2);
    expect(A7_WIDTH_PT * 2).toBeCloseTo(A5_WIDTH_PT, 1);
    expect(A7_HEIGHT_PT * 2).toBeCloseTo(A5_HEIGHT_PT, 1);
  });
});
