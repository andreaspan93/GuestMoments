import { readFileSync } from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  moveTo,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { drawTrackedLine } from "@/lib/events/poster-text";
import el from "../../../messages/el.json";
import en from "../../../messages/en.json";
import { isLogoSize, type LogoSize } from "@/lib/events/appearance";
import {
  POSTER_COVER_CAP_CQH,
  POSTER_COVER_MM,
  POSTER_COVER_WITH_LOGO_CAP_CQH,
  POSTER_COVER_WITH_LOGO_MM,
  POSTER_CTA_CAP_CQH,
  POSTER_CTA_GAP_MM,
  POSTER_CTA_MM,
  POSTER_DATE_GAP_MM,
  POSTER_DATE_SIZE_MM,
  POSTER_PAD_BOTTOM_MM,
  POSTER_PAD_TOP_MM,
  POSTER_PAD_X_MM,
  POSTER_PAGE_CQH_MM,
  POSTER_PHOTO_GAP_MM,
  POSTER_QR_CAP_CQH,
  POSTER_QR_GAP_MM,
  POSTER_QR_MM,
  POSTER_QR_WITH_LOGO_CAP_CQH,
  POSTER_QR_WITH_LOGO_MM,
  POSTER_STACK_GAP_MM,
  POSTER_TITLE_MAX_MM,
  POSTER_TOP_FREE_SHARE,
  posterFullPageMm,
} from "@/lib/events/poster-layout";
import {
  fittedTitleSizeMm,
  posterTitleRuns,
  posterTitleText,
  titleFontFile,
  type PosterTitleRun,
} from "@/lib/events/poster-title";

export const A5_WIDTH_MM = 148;
export const A5_HEIGHT_MM = 210;

const MM = 72 / 25.4;

export const A5_WIDTH_PT = A5_WIDTH_MM * MM;
export const A5_HEIGHT_PT = A5_HEIGHT_MM * MM;

const padX = POSTER_PAD_X_MM * MM;
const padTop = POSTER_PAD_TOP_MM * MM;
const padBottom = POSTER_PAD_BOTTOM_MM * MM;
export const PDF_TITLE_MAX_MM = POSTER_TITLE_MAX_MM;
export const PDF_DATE_SIZE_MM = POSTER_DATE_SIZE_MM;
export const posterContentWidthPt = A5_WIDTH_PT - padX * 2;
const contentWidth = posterContentWidthPt;
const contentHeight = A5_HEIGHT_PT - padTop - padBottom;

type PosterImage = {
  bytes: Uint8Array;
};

export type PosterPdfInput = {
  name: string;
  titleFont?: string;
  nameSizeMm?: number;
  dateFont?: string;
  dateSizeMm?: number;
  dateLabel: string;
  cta: string;
  locale: "en" | "el";
  logoSize: string;
  logoCorner: string;
  cover?: PosterImage | null;
  logo?: PosterImage | null;
  qr: PosterImage;
};

type DrawnImage = PDFImage;

type Block = {
  height: number;
  gapBefore: number;
  draw: (page: PDFPage, top: number) => void;
};

function mm(value: number) {
  return value * MM;
}

export function posterContentTop(blockHeight: number) {
  const free = Math.max(0, contentHeight - blockHeight);
  return A5_HEIGHT_PT - padTop - free * POSTER_TOP_FREE_SHARE;
}

function fontBytes(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName));
}

export function posterCta(locale: "en" | "el") {
  return locale === "el" ? el.events.qrPosterCta : en.events.qrPosterCta;
}

function logoSizeMm(size: string) {
  const known: LogoSize = isLogoSize(size) ? size : "medium";
  const heights: Record<LogoSize, number> = {
    small: Math.min(12.5 * POSTER_PAGE_CQH_MM, 26),
    medium: Math.min(16 * POSTER_PAGE_CQH_MM, 34),
    large: Math.min(19 * POSTER_PAGE_CQH_MM, 40),
    "extra-large": Math.min(22 * POSTER_PAGE_CQH_MM, 46),
  };

  return heights[known];
}

export function posterTitleSizePt(
  widthAtSize: (size: number) => number,
  name: string,
  titleFont?: string,
  scale = 1,
  maxMm = PDF_TITLE_MAX_MM,
) {
  const fittedTitle = mm(fittedTitleSizeMm(name, titleFont, maxMm)) * scale;
  const width = widthAtSize(fittedTitle);

  if (!posterTitleText(name) || !Number.isFinite(width) || width <= 0 || width <= contentWidth) {
    return fittedTitle;
  }

  return (fittedTitle * contentWidth) / width;
}

function titleRunWidth(faces: Map<string, PDFFont>, run: PosterTitleRun, size: number) {
  const face = faces.get(titleFontFile(run.fontId));
  return face ? face.widthOfTextAtSize(run.text, size) : 0;
}

function singleLineSize(font: PDFFont, text: string, maxSize: number, maxWidth: number) {
  if (!text || maxSize <= 0) {
    return maxSize;
  }

  const width = font.widthOfTextAtSize(text, maxSize);

  if (!Number.isFinite(width) || width <= 0 || width <= maxWidth) {
    return maxSize;
  }

  return (maxSize * maxWidth) / width;
}

function trackedWidth(font: PDFFont, text: string, size: number, tracking: number) {
  const characters = Array.from(text);
  const width = font.widthOfTextAtSize(text, size);

  return width + Math.max(0, characters.length - 1) * tracking;
}

function drawTracked(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  font: PDFFont,
  size: number,
  tracking: number,
  color: ReturnType<typeof rgb>,
) {
  drawTrackedLine(page, text, x, y, font, size, tracking, color);
}

function clipCircle(page: PDFPage, centerX: number, centerY: number, radius: number) {
  const control = radius * 0.5522847498307936;

  page.pushOperators(
    pushGraphicsState(),
    moveTo(centerX + radius, centerY),
    appendBezierCurve(
      centerX + radius,
      centerY + control,
      centerX + control,
      centerY + radius,
      centerX,
      centerY + radius,
    ),
    appendBezierCurve(
      centerX - control,
      centerY + radius,
      centerX - radius,
      centerY + control,
      centerX - radius,
      centerY,
    ),
    appendBezierCurve(
      centerX - radius,
      centerY - control,
      centerX - control,
      centerY - radius,
      centerX,
      centerY - radius,
    ),
    appendBezierCurve(
      centerX + control,
      centerY - radius,
      centerX + radius,
      centerY - control,
      centerX + radius,
      centerY,
    ),
    closePath(),
    clip(),
    endPath(),
  );
}

async function embed(pdf: PDFDocument, image: PosterImage | null | undefined) {
  if (!image) {
    return null;
  }

  const bytes = image.bytes;

  try {
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      return await pdf.embedJpg(bytes);
    }

    if (bytes[0] === 0x89 && bytes[1] === 0x50) {
      return await pdf.embedPng(bytes);
    }
  } catch {
    return null;
  }

  return null;
}

async function embedTitleFont(pdf: PDFDocument, titleFont: string, text: string) {
  const preferred = titleFontFile(titleFont);
  const files = preferred === "NotoSans-SemiBold.ttf" ? [preferred] : [preferred, "NotoSans-SemiBold.ttf"];
  let failure: unknown;

  for (const fileName of files) {
    try {
      const font = await pdf.embedFont(fontBytes(fileName), { subset: true });

      if (text) {
        font.widthOfTextAtSize(text, 12);
      }

      return font;
    } catch (error) {
      failure = error;
    }
  }

  throw failure instanceof Error ? failure : new Error("Poster title font could not be embedded.");
}

function coverBox(hasLogo: boolean, scale: number) {
  const size = hasLogo
    ? posterFullPageMm(POSTER_COVER_WITH_LOGO_MM, POSTER_COVER_WITH_LOGO_CAP_CQH)
    : posterFullPageMm(POSTER_COVER_MM, POSTER_COVER_CAP_CQH);

  return mm(size) * scale;
}

function drawCover(page: PDFPage, image: DrawnImage, box: number, top: number) {
  const scale = Math.max(box / image.width, box / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (A5_WIDTH_PT - box) / 2;
  const y = top - box;
  const centerX = x + box / 2;
  const centerY = y + box / 2;

  clipCircle(page, centerX, centerY, box / 2);
  page.drawImage(image, {
    x: x + (box - width) / 2,
    y: y + (box - height) / 2,
    width,
    height,
  });
  page.pushOperators(popGraphicsState());
}

function drawContained(
  page: PDFPage,
  image: DrawnImage,
  maxWidth: number,
  maxHeight: number,
  top: number,
  rounded: boolean,
) {
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const x = (A5_WIDTH_PT - width) / 2;
  const y = top - height;

  if (!rounded) {
    page.drawImage(image, { x, y, width, height });
    return height;
  }

  const box = Math.max(width, height);
  const boxX = (A5_WIDTH_PT - box) / 2;
  const boxY = top - box;
  const cover = Math.max(box / image.width, box / image.height);
  const drawnWidth = image.width * cover;
  const drawnHeight = image.height * cover;

  clipCircle(page, boxX + box / 2, boxY + box / 2, box / 2);
  page.drawImage(image, {
    x: boxX + (box - drawnWidth) / 2,
    y: boxY + (box - drawnHeight) / 2,
    width: drawnWidth,
    height: drawnHeight,
  });
  page.pushOperators(popGraphicsState());

  return box;
}

export async function buildPosterPdf(input: PosterPdfInput) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(fontBytes("NotoSans-Regular.ttf"), { subset: true });
  const dateFace = input.dateFont
    ? await embedTitleFont(pdf, input.dateFont, input.dateLabel)
    : regular;
  const titleMaxMm = input.nameSizeMm ?? PDF_TITLE_MAX_MM;
  const dateMaxMm = input.dateSizeMm ?? PDF_DATE_SIZE_MM;
  const titleRuns = posterTitleRuns(input.name, input.titleFont);
  const titleFaces = new Map<string, PDFFont>();

  for (const run of titleRuns) {
    const fileName = titleFontFile(run.fontId);

    if (!titleFaces.has(fileName)) {
      titleFaces.set(fileName, await embedTitleFont(pdf, run.fontId, run.text));
    }
  }

  const titleWidth = (size: number) =>
    titleRuns.reduce((sum, run) => sum + titleRunWidth(titleFaces, run, size), 0);
  const cover = await embed(pdf, input.cover);
  const logo = await embed(pdf, input.logo);
  const qr = await embed(pdf, input.qr);

  if (!qr) {
    throw new Error("Poster QR image is not a PNG or JPEG.");
  }
  const hasLogo = Boolean(logo);
  const ink = rgb(0.067, 0.067, 0.067);
  const caption = rgb(0.604, 0.604, 0.604);

  const measure = (scale: number) => {
    const blocks: Block[] = [];
    const titleSize = posterTitleSizePt(titleWidth, input.name, input.titleFont, scale, titleMaxMm);
    const titleHeight = titleSize * 1.12;
    const dateSize = singleLineSize(dateFace, input.dateLabel, mm(dateMaxMm) * scale, contentWidth);
    const dateHeight = dateSize * 1.2;
    const ctaSize = mm(posterFullPageMm(POSTER_CTA_MM, POSTER_CTA_CAP_CQH)) * scale;
    const tracking = ctaSize * 0.2;
    const ctaLines = input.cta
      .split("\n")
      .map((line) => line.toLocaleUpperCase(input.locale));
    const ctaHeight = ctaLines.length * ctaSize * 1.65;
    const qrBox =
      mm(
        hasLogo
          ? posterFullPageMm(POSTER_QR_WITH_LOGO_MM, POSTER_QR_WITH_LOGO_CAP_CQH)
          : posterFullPageMm(POSTER_QR_MM, POSTER_QR_CAP_CQH),
      ) * scale;

    blocks.push({
      height: titleHeight,
      gapBefore: 0,
      draw: (page, top) => {
        let cursor = (A5_WIDTH_PT - titleWidth(titleSize)) / 2;

        for (const run of titleRuns) {
          const width = titleRunWidth(titleFaces, run, titleSize);
          const face = titleFaces.get(titleFontFile(run.fontId));

          if (!face || !run.text) {
            cursor += width;
            continue;
          }

          page.drawText(run.text, {
            x: cursor,
            y: top - titleSize,
            size: titleSize,
            font: face,
            color: ink,
          });
          cursor += width;
        }
      },
    });

    blocks.push({
      height: dateHeight,
      gapBefore: mm(POSTER_DATE_GAP_MM) * scale,
      draw: (page, top) => {
        const width = dateFace.widthOfTextAtSize(input.dateLabel, dateSize);

        page.drawText(input.dateLabel, {
          x: (A5_WIDTH_PT - width) / 2,
          y: top - dateSize,
          size: dateSize,
          font: dateFace,
          color: ink,
        });
      },
    });

    if (cover) {
      blocks.push({
        height: coverBox(hasLogo, scale),
        gapBefore: mm(POSTER_PHOTO_GAP_MM) * scale,
        draw: (page, top) => drawCover(page, cover, coverBox(hasLogo, scale), top),
      });
    }

    if (logo) {
      const box = mm(logoSizeMm(input.logoSize)) * scale;
      const rounded = input.logoCorner === "rounded";

      blocks.push({
        height: box,
        gapBefore: mm(POSTER_STACK_GAP_MM) * scale,
        draw: (page, top) => {
          drawContained(page, logo, rounded ? box : contentWidth, box, top, rounded);
        },
      });
    }

    if (qr) {
      blocks.push({
        height: qrBox,
        gapBefore: mm(POSTER_QR_GAP_MM) * scale,
        draw: (page, top) => {
          page.drawImage(qr, {
            x: (A5_WIDTH_PT - qrBox) / 2,
            y: top - qrBox,
            width: qrBox,
            height: qrBox,
          });
        },
      });
    }

    blocks.push({
      height: ctaHeight,
      gapBefore: mm(POSTER_CTA_GAP_MM) * scale,
      draw: (page, top) => {
        ctaLines.forEach((line, index) => {
          const width = trackedWidth(regular, line, ctaSize, tracking);
          const y = top - ctaSize * 1.65 * (index + 1) + ctaSize * 0.35;

          drawTracked(
            page,
            line,
            (A5_WIDTH_PT - width) / 2,
            y,
            regular,
            ctaSize,
            tracking,
            caption,
          );
        });
      },
    });

    const height = blocks.reduce((sum, block) => sum + block.gapBefore + block.height, 0);

    return { blocks, height };
  };

  const natural = measure(1);
  const scale = natural.height > contentHeight ? contentHeight / natural.height : 1;
  const laid = scale === 1 ? natural : measure(scale);
  const page = pdf.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: A5_WIDTH_PT,
    height: A5_HEIGHT_PT,
    color: rgb(1, 1, 1),
  });

  let top = posterContentTop(laid.height);

  for (const block of laid.blocks) {
    top -= block.gapBefore;
    block.draw(page, top);
    top -= block.height;
  }

  if (top < padBottom - 1) {
    throw new Error("Poster content does not fit on one A5 page.");
  }

  return pdf.save();
}
