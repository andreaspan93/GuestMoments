import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { A8_LANDSCAPE_HEIGHT_MM, A8_LANDSCAPE_HEIGHT_PT, A8_LANDSCAPE_WIDTH_PT } from "@/lib/events/poster-paper";
import { A5_HEIGHT_MM } from "@/lib/events/poster-pdf";
import { drawTrackedLine } from "@/lib/events/poster-text";
import { posterTitleRuns, titleFontFile, type PosterTitleRun } from "@/lib/events/poster-title";
import { resolvePosterTypography, type PosterTypography } from "@/lib/events/poster-typography";
import type { SharePosterPdfInput } from "@/lib/events/share-poster-pdf";

const ink = rgb(0.102, 0.102, 0.102);
const paper = rgb(1, 1, 1);

/** A5 millimetre sizes become this fraction of themselves on a 52mm-tall card. */
const CARD_SCALE = A8_LANDSCAPE_HEIGHT_MM / A5_HEIGHT_MM;

function pt(sizeMm: number) {
  return (sizeMm * 72) / 25.4;
}

function fontBytes(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName));
}

function trackedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  const characters = Array.from(text);

  return font.widthOfTextAtSize(text, size) + Math.max(0, characters.length - 1) * tracking;
}

function fitSize(width: number, size: number, maxWidth: number) {
  if (!width || width <= maxWidth) {
    return size;
  }

  return (size * maxWidth) / width;
}

function wrapText(text: string, widthOf: (value: string) => number, maxWidth: number) {
  const words = text.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;

    if (!current || widthOf(next) <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current);
    current = word;
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

async function embedRuns(pdf: PDFDocument, runs: PosterTitleRun[]) {
  const faces = new Map<string, PDFFont>();

  for (const run of runs) {
    const fileName = titleFontFile(run.fontId);

    if (faces.has(fileName)) {
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

function drawRuns(
  page: PDFPage,
  faces: Map<string, PDFFont>,
  runs: PosterTitleRun[],
  size: number,
  x: number,
  baseline: number,
) {
  let cursor = x;

  for (const run of runs) {
    const face = faces.get(titleFontFile(run.fontId));

    if (!face || !run.text) {
      continue;
    }

    page.drawText(run.text, { x: cursor, y: baseline, size, font: face, color: ink });
    cursor += face.widthOfTextAtSize(run.text, size);
  }
}

type Row = {
  height: number;
  gapBefore: number;
  draw: (baseline: number) => void;
};

export async function buildCardPosterPdf(input: SharePosterPdfInput) {
  const typography: PosterTypography = resolvePosterTypography(input.typography);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([A8_LANDSCAPE_WIDTH_PT, A8_LANDSCAPE_HEIGHT_PT]);
  const sans = await pdf.embedFont(fontBytes("NotoSans-Regular.ttf"), { subset: true });
  const scriptRuns = posterTitleRuns(input.script, typography.scriptFont);
  const nameRuns = posterTitleRuns(input.name, typography.nameFont);
  const kickerRuns = posterTitleRuns(input.kicker, typography.kickerFont);
  const dateRuns = posterTitleRuns(input.dateLabel, typography.dateFont);
  const faces = await embedRuns(pdf, [...scriptRuns, ...kickerRuns, ...nameRuns, ...dateRuns]);
  const qr = await pdf.embedPng(input.qr.bytes);
  const camera = await pdf.embedPng(readFileSync(path.join(process.cwd(), "public", "camera-icon.png")));
  const faceFor = (runs: PosterTitleRun[]) => faces.get(titleFontFile(runs[0]?.fontId ?? "noto-sans")) ?? sans;
  const pad = pt(3.6);
  const qrSize = pt(22);
  const cameraWidth = pt(typography.cameraSizeMm);
  const cameraHeight = cameraWidth * (camera.height / camera.width);
  const qrLift = pt(5.2);
  const qrX = A8_LANDSCAPE_WIDTH_PT - pad - qrSize;
  const textX = pad;
  const textWidth = qrX - pt(2.8) - textX;
  const innerHeight = A8_LANDSCAPE_HEIGHT_PT - pad * 2;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: A8_LANDSCAPE_WIDTH_PT,
    height: A8_LANDSCAPE_HEIGHT_PT,
    color: paper,
  });

  const rowsAt = (scale: number): Row[] => {
    const rows: Row[] = [];
    const gap = pt(1.05) * scale;
    const addRuns = (runs: PosterTitleRun[], size: number, gapBefore: number, tracking = 0) => {
      const font = faceFor(runs);
      const single = runs.length === 1 && runs[0];
      const width =
        single && tracking
          ? trackedWidth(font, single.text, size, tracking)
          : runs.reduce((sum, run) => {
              const face = faces.get(titleFontFile(run.fontId));
              return sum + (face ? face.widthOfTextAtSize(run.text, size) : 0);
            }, 0);
      const fitted = fitSize(width, size, textWidth);
      const fittedTracking = tracking * (size > 0 ? fitted / size : 1);

      rows.push({
        height: fitted * 1.15,
        gapBefore,
        draw: (baseline) => {
          if (single && fittedTracking) {
            drawTrackedLine(page, single.text, textX, baseline, font, fitted, fittedTracking, ink);
            return;
          }

          drawRuns(page, faces, runs, fitted, textX, baseline);
        },
      });
    };
    const addSans = (text: string, size: number, tracking: number, gapBefore: number) => {
      const widest = text.split(/\s+/).reduce((width, word) => {
        return Math.max(width, trackedWidth(sans, word, size, tracking));
      }, 0);
      const fitted = fitSize(widest, size, textWidth);
      const fittedTracking = tracking * (size > 0 ? fitted / size : 1);
      const lines = wrapText(text, (value) => trackedWidth(sans, value, fitted, fittedTracking), textWidth);

      lines.forEach((line, index) => {
        rows.push({
          height: fitted * 1.2,
          gapBefore: index === 0 ? gapBefore : fitted * 0.16,
          draw: (baseline) => {
            drawTrackedLine(page, line, textX, baseline, sans, fitted, fittedTracking, ink);
          },
        });
      });
    };

    addRuns(kickerRuns, pt(typography.kickerSizeMm) * CARD_SCALE * scale, 0, pt(typography.kickerSizeMm) * CARD_SCALE * scale * 0.2);
    addRuns(scriptRuns, pt(typography.scriptSizeMm) * CARD_SCALE * scale, gap);
    const nameLines = wrapText(input.name, (value) => {
      const runs = posterTitleRuns(value, typography.nameFont);
      const size = pt(typography.nameSizeMm) * CARD_SCALE * scale;
      return runs.reduce((sum, run) => {
        const face = faces.get(titleFontFile(run.fontId));
        return sum + (face ? face.widthOfTextAtSize(run.text, size) : 0);
      }, 0);
    }, textWidth);
    const nameSize = pt(typography.nameSizeMm) * CARD_SCALE * scale;

    nameLines.forEach((line, index) => {
      addRuns(posterTitleRuns(line, typography.nameFont), nameSize, index === 0 ? gap * 1.35 : nameSize * 0.12);
    });
    addRuns(
      dateRuns,
      pt(typography.dateSizeMm) * CARD_SCALE * scale,
      gap * 0.7,
      pt(typography.dateSizeMm) * CARD_SCALE * scale * 0.16,
    );
    addSans(input.line2, pt(2.15) * scale, pt(2.15) * scale * 0.03, gap * 0.7);

    return rows;
  };

  let scale = 1.15;
  let rows = rowsAt(scale);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const height = rows.reduce((sum, row) => sum + row.gapBefore + row.height, 0);

    if (height <= innerHeight) {
      break;
    }

    scale *= (innerHeight / height) * 0.96;
    rows = rowsAt(scale);
  }

  const stackHeight = rows.reduce((sum, row) => sum + row.gapBefore + row.height, 0);
  let top = (A8_LANDSCAPE_HEIGHT_PT + stackHeight) / 2;

  for (const row of rows) {
    top -= row.gapBefore;
    row.draw(top - row.height * 0.78);
    top -= row.height;
  }

  page.drawImage(qr, {
    x: qrX,
    y: pad + qrLift,
    width: qrSize,
    height: qrSize,
  });
  page.drawImage(camera, {
    x: qrX + (qrSize - cameraWidth) / 2,
    y: A8_LANDSCAPE_HEIGHT_PT - pad - cameraHeight,
    width: cameraWidth,
    height: cameraHeight,
  });

  return pdf.save();
}
