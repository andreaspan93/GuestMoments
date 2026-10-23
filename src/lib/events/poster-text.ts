import {
  beginText,
  endText,
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
 * Draw one tracked line as separate, absolutely positioned glyphs.
 * pdf-lib subset fonts drop glyphs when each character is encoded through its
 * own drawText call. The Tc operator then shifts the remaining glyphs: some
 * viewers keep only the trailing letters, so SHARE renders as RE.
 * Each letter is placed from the measured advance instead.
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
  const characters = Array.from(text);

  if (characters.length === 0 || size <= 0) {
    return;
  }

  page.setFont(font);
  page.setFontColor(color);
  font.encodeText(text);
  const fontKey = (page as unknown as PageWithFontKey).fontKey;

  if (!fontKey) {
    throw new Error("Poster font is not selected.");
  }

  const operators = [
    pushGraphicsState(),
    beginText(),
    setFillingColor(color),
    setFontAndSize(fontKey, size),
  ];
  let cursor = x;

  for (const character of characters) {
    operators.push(setTextMatrix(1, 0, 0, 1, cursor, y), showText(font.encodeText(character)));
    cursor += font.widthOfTextAtSize(character, size) + tracking;
  }

  operators.push(endText(), popGraphicsState());
  page.pushOperators(...operators);
}
