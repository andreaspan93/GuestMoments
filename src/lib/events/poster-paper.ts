import { PDFDocument } from "pdf-lib";

const MM = 72 / 25.4;

/** ISO 216 A7, portrait. */
export const A7_WIDTH_MM = 74;
export const A7_HEIGHT_MM = 105;
export const A7_WIDTH_PT = A7_WIDTH_MM * MM;
export const A7_HEIGHT_PT = A7_HEIGHT_MM * MM;

/** Place an A5 poster page onto A7 paper. The artwork is scaled to the page. */
export async function fitPosterPdfToA7(bytes: Uint8Array) {
  const source = await PDFDocument.load(bytes);
  const pdf = await PDFDocument.create();
  const [embedded] = await pdf.embedPdf(source, [0]);
  const page = pdf.addPage([A7_WIDTH_PT, A7_HEIGHT_PT]);

  page.drawPage(embedded, {
    x: 0,
    y: 0,
    width: A7_WIDTH_PT,
    height: A7_HEIGHT_PT,
  });

  return pdf.save();
}
