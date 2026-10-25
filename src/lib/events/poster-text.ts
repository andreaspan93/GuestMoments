import {
  beginText,
  endText,
  PDFArray,
  PDFHexString,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  popGraphicsState,
  pushGraphicsState,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  showText,
  type Color,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

type PageWithFontKey = { fontKey?: Parameters<typeof setFontAndSize>[0] };

/**
 * fontkit's subsetter writes empty or unreadable outlines for some glyphs in
 * these faces, so those letters keep their width and disappear in the PDF.
 */
const wholeFontFiles = new Set(["GFSDidot-Regular.ttf", "PlaypenSans-Regular.ttf"]);

export function posterFontSubset(fileName: string) {
  return !wholeFontFiles.has(fileName);
}

/**
 * Draw one tracked line from a single subset encoding.
 * Encoding each letter on its own leaves a hole in the subset font, so the A
 * in SHARE keeps its advance and disappears. The Tc operator also walks the
 * line off the page in some viewers. One TJ show places every glyph.
 */
export function drawTrackedLine(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  tracking: number,
  color: Color,
) {
  if (!text || size <= 0) {
    return;
  }

  page.setFont(font);
  page.setFontColor(color);
  const encoded = font.encodeText(text);
  const fontKey = (page as unknown as PageWithFontKey).fontKey;

  if (!fontKey) {
    throw new Error("Poster font is not selected.");
  }

  page.pushOperators(
    pushGraphicsState(),
    beginText(),
    setFillingColor(color),
    setFontAndSize(fontKey, size),
    setTextMatrix(1, 0, 0, 1, x, y),
    tracking === 0 ? showText(encoded) : showTrackedGlyphs(page, encoded, size, tracking),
    endText(),
    popGraphicsState(),
  );
}

function showTrackedGlyphs(page: PDFPage, encoded: ReturnType<PDFFont["encodeText"]>, size: number, tracking: number) {
  const glyphs = String(encoded).replace(/[<>\s]/g, "").match(/.{4}/g) ?? [];
  const positioned = PDFArray.withContext(page.doc.context);
  const adjust = PDFNumber.of((-tracking / size) * 1000);

  glyphs.forEach((glyph, index) => {
    positioned.push(PDFHexString.of(glyph));

    if (index < glyphs.length - 1) {
      positioned.push(adjust);
    }
  });

  return PDFOperator.of(PDFOperatorNames.ShowTextAdjusted, [positioned]);
}
