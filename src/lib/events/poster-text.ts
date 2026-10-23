import {
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSpacing,
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
 * Draw one tracked line as a single text show.
 * pdf-lib subset fonts corrupt or drop glyphs when each character is encoded
 * and drawn on its own, which clipped SHARE down to SH.
 * Character spacing is in user-space points because the text matrix is unscaled.
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
    setCharacterSpacing(tracking),
    setTextMatrix(1, 0, 0, 1, x, y),
    showText(encoded),
    endText(),
    popGraphicsState(),
  );
}
