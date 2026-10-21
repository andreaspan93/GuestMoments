import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { A5_HEIGHT_PT, A5_WIDTH_PT } from "@/lib/events/poster-pdf";
import { posterTitleRuns, titleFontFile, type PosterTitleRun } from "@/lib/events/poster-title";

const ink = rgb(0.102, 0.102, 0.102);
const paper = rgb(0.956, 0.956, 0.956);

export type SharePosterPdfInput = {
  name: string;
  dateLabel: string;
  kicker: string;
  script: string;
  line1: string;
  line2: string;
  qr: { bytes: Uint8Array };
};

function fontBytes(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName));
}

function trackedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  const characters = Array.from(text);

  return font.widthOfTextAtSize(text, size) + Math.max(0, characters.length - 1) * tracking;
}

function drawTracked(
  page: PDFPage,
  text: string,
  centerX: number,
  baseline: number,
  font: PDFFont,
  size: number,
  tracking: number,
) {
  const characters = Array.from(text);
  let cursor = centerX - trackedWidth(font, text, size, tracking) / 2;

  for (const character of characters) {
    page.drawText(character, { x: cursor, y: baseline, size, font, color: ink });
    cursor += font.widthOfTextAtSize(character, size) + tracking;
  }
}

function fitTracked(font: PDFFont, text: string, size: number, tracking: number, maxWidth: number) {
  const width = trackedWidth(font, text, size, tracking);

  if (!text || !Number.isFinite(width) || width <= 0 || width <= maxWidth) {
    return { size, tracking };
  }

  const scale = maxWidth / width;

  return { size: size * scale, tracking: tracking * scale };
}

function runWidth(faces: Map<string, PDFFont>, runs: PosterTitleRun[], size: number) {
  return runs.reduce((sum, run) => {
    const face = faces.get(titleFontFile(run.fontId));

    return sum + (face ? face.widthOfTextAtSize(run.text, size) : 0);
  }, 0);
}

function fitRuns(faces: Map<string, PDFFont>, runs: PosterTitleRun[], size: number, maxWidth: number) {
  const width = runWidth(faces, runs, size);

  if (!width || width <= maxWidth) {
    return size;
  }

  return (size * maxWidth) / width;
}

function drawRuns(
  page: PDFPage,
  faces: Map<string, PDFFont>,
  runs: PosterTitleRun[],
  size: number,
  baseline: number,
) {
  const widths = runs.map((run) => faces.get(titleFontFile(run.fontId))?.widthOfTextAtSize(run.text, size) ?? 0);
  let cursor = (A5_WIDTH_PT - widths.reduce((sum, width) => sum + width, 0)) / 2;

  runs.forEach((run, index) => {
    const face = faces.get(titleFontFile(run.fontId));

    if (!face || !run.text) {
      return;
    }

    page.drawText(run.text, { x: cursor, y: baseline, size, font: face, color: ink });
    cursor += widths[index] ?? 0;
  });

  return widths.reduce((sum, width) => sum + width, 0);
}

async function embedRuns(pdf: PDFDocument, runs: PosterTitleRun[]) {
  const faces = new Map<string, PDFFont>();

  for (const run of runs) {
    const fileName = titleFontFile(run.fontId);

    if (faces.has(fileName)) {
      faces.get(fileName)?.widthOfTextAtSize(run.text, 12);
      continue;
    }

    const font = await pdf.embedFont(fontBytes(fileName), { subset: true });

    if (run.text) {
      font.widthOfTextAtSize(run.text, 12);
    }

    faces.set(fileName, font);
  }

  return faces;
}

export async function buildSharePosterPdf(input: SharePosterPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]);
  const sans = await pdf.embedFont(fontBytes("NotoSans-Regular.ttf"), { subset: true });
  const scriptRuns = posterTitleRuns(input.script, "mynerve");
  const nameRuns = posterTitleRuns(input.name, "mynerve");
  const faces = await embedRuns(pdf, [...scriptRuns, ...nameRuns]);
  const qr = await pdf.embedPng(input.qr.bytes);
  const contentWidth = A5_WIDTH_PT - 72;
  const kicker = fitTracked(sans, input.kicker, 15, 6.2, contentWidth);
  const line1 = fitTracked(sans, input.line1, 8.4, 1.15, contentWidth);
  const line2 = fitTracked(sans, input.line2, 8.4, 1.15, contentWidth);
  const scriptSize = fitRuns(faces, scriptRuns, 40, contentWidth * 0.62);
  const nameSize = fitRuns(faces, nameRuns, 26, contentWidth * 0.92);
  const date = fitTracked(sans, input.dateLabel, 11, 2.4, contentWidth);
  const qrSize = 148;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: A5_WIDTH_PT,
    height: A5_HEIGHT_PT,
    color: paper,
  });

  const pieces = [
    sans.heightAtSize(kicker.size),
    faces.values().next().value?.heightAtSize(scriptSize) ?? scriptSize,
    sans.heightAtSize(line1.size),
    sans.heightAtSize(line2.size),
    qrSize,
    faces.values().next().value?.heightAtSize(nameSize) ?? nameSize,
    sans.heightAtSize(date.size),
  ];
  const gapWeights = [1.45, 0.28, 0.85, 0.22, 0.95, 0.72, 0.28, 1.2];
  const free = Math.max(48, A5_HEIGHT_PT - pieces.reduce((sum, height) => sum + height, 0));
  const gapUnit = free / gapWeights.reduce((sum, weight) => sum + weight, 0);
  let top = gapWeights[0] * gapUnit;

  const baseline = (font: PDFFont, size: number) => A5_HEIGHT_PT - top - font.heightAtSize(size) * 0.78;

  drawTracked(page, input.kicker, A5_WIDTH_PT / 2, baseline(sans, kicker.size), sans, kicker.size, kicker.tracking);
  top += pieces[0] + gapWeights[1] * gapUnit;

  const scriptFont = faces.get(titleFontFile(scriptRuns[0]?.fontId ?? "mynerve")) ?? sans;
  const scriptBaseline = baseline(scriptFont, scriptSize);
  const scriptWidth = drawRuns(page, faces, scriptRuns, scriptSize, scriptBaseline);
  const ruleY = scriptBaseline + scriptSize * 0.28;
  const ruleGap = 10;
  const textLeft = (A5_WIDTH_PT - scriptWidth) / 2;

  if (textLeft - ruleGap > 36) {
    page.drawLine({
      start: { x: 36, y: ruleY },
      end: { x: textLeft - ruleGap, y: ruleY },
      thickness: 0.7,
      color: ink,
    });
    page.drawLine({
      start: { x: textLeft + scriptWidth + ruleGap, y: ruleY },
      end: { x: A5_WIDTH_PT - 36, y: ruleY },
      thickness: 0.7,
      color: ink,
    });
  }

  top += pieces[1] + gapWeights[2] * gapUnit;
  drawTracked(page, input.line1, A5_WIDTH_PT / 2, baseline(sans, line1.size), sans, line1.size, line1.tracking);
  top += pieces[2] + gapWeights[3] * gapUnit;
  drawTracked(page, input.line2, A5_WIDTH_PT / 2, baseline(sans, line2.size), sans, line2.size, line2.tracking);
  top += pieces[3] + gapWeights[4] * gapUnit;

  page.drawImage(qr, {
    x: (A5_WIDTH_PT - qrSize) / 2,
    y: A5_HEIGHT_PT - top - qrSize,
    width: qrSize,
    height: qrSize,
  });
  top += pieces[4] + gapWeights[5] * gapUnit;

  const nameFont = faces.get(titleFontFile(nameRuns[0]?.fontId ?? "mynerve")) ?? sans;
  drawRuns(page, faces, nameRuns, nameSize, baseline(nameFont, nameSize));
  top += pieces[5] + gapWeights[6] * gapUnit;
  drawTracked(page, input.dateLabel, A5_WIDTH_PT / 2, baseline(sans, date.size), sans, date.size, date.tracking);

  return pdf.save();
}
