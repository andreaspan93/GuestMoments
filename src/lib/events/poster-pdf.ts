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
import el from "../../../messages/el.json";
import en from "../../../messages/en.json";
import { isLogoSize, type LogoSize } from "@/lib/events/appearance";

export const A5_WIDTH_MM = 148;
export const A5_HEIGHT_MM = 210;

const MM = 72 / 25.4;

export const A5_WIDTH_PT = A5_WIDTH_MM * MM;
export const A5_HEIGHT_PT = A5_HEIGHT_MM * MM;

const padX = 11 * MM;
const padTop = 11 * MM;
const padBottom = 12 * MM;
const contentWidth = A5_WIDTH_PT - padX * 2;
const contentHeight = A5_HEIGHT_PT - padTop - padBottom;

type PosterImage = {
  bytes: Uint8Array;
};

export type PosterPdfInput = {
  name: string;
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

function fontBytes(fileName: string) {
  return readFileSync(path.join(process.cwd(), "src/lib/events/fonts", fileName));
}

export function posterCta(locale: "en" | "el") {
  return locale === "el" ? el.events.qrPosterCta : en.events.qrPosterCta;
}

function titleSizeMm(name: string) {
  const length = Array.from(name.trim()).length;

  if (length > 80) {
    return 2.2 * 2.1;
  }

  if (length > 48) {
    return 3 * 2.1;
  }

  if (length > 28) {
    return 3.8 * 2.1;
  }

  return 5.6 * 2.1;
}

function logoSizeMm(size: string) {
  const known: LogoSize = isLogoSize(size) ? size : "medium";
  const heights: Record<LogoSize, number> = {
    small: Math.min(12.5 * 2.1, 26),
    medium: Math.min(16 * 2.1, 34),
    large: Math.min(19 * 2.1, 40),
    "extra-large": Math.min(22 * 2.1, 46),
  };

  return heights[known];
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number) {
  const characters = Array.from(text);
  const lines: string[] = [];
  let line = "";

  for (const character of characters) {
    const next = `${line}${character}`;

    if (line && font.widthOfTextAtSize(next, size) > maxWidth) {
      lines.push(line);
      line = character.trim() === "" ? "" : character;
      continue;
    }

    line = next;
  }

  if (line) {
    lines.push(line);
  }

  return lines.length > 0 ? lines : [""];
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
  let cursor = x;

  for (const character of Array.from(text)) {
    page.drawText(character, { x: cursor, y, size, font, color });
    cursor += font.widthOfTextAtSize(character, size) + tracking;
  }
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

function coverBox(hasLogo: boolean, scale: number) {
  return mm(hasLogo ? 30 : 62) * scale;
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
  const semibold = await pdf.embedFont(fontBytes("NotoSans-SemiBold.ttf"), { subset: true });
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
    const titleSize = mm(titleSizeMm(input.name)) * scale;
    const titleLines = wrapText(semibold, input.name, titleSize, contentWidth);
    const titleHeight = titleLines.length * titleSize * 1.12;
    const dateSize = mm(7.2) * scale;
    const dateHeight = dateSize * 1.2;
    const ctaSize = mm(3.15) * scale;
    const tracking = ctaSize * 0.2;
    const ctaLines = input.cta
      .split("\n")
      .map((line) => line.toLocaleUpperCase(input.locale));
    const ctaHeight = ctaLines.length * ctaSize * 1.65;
    const qrBox = mm(hasLogo ? Math.min(38, 18 * 2.1) : Math.min(44, 21 * 2.1)) * scale;

    if (cover) {
      blocks.push({
        height: coverBox(hasLogo, scale),
        gapBefore: 0,
        draw: (page, top) => drawCover(page, cover, coverBox(hasLogo, scale), top),
      });
    }

    blocks.push({
      height: titleHeight,
      gapBefore: blocks.length > 0 ? mm(3.4) * scale + mm(hasLogo ? 0 : 2.2) * scale : 0,
      draw: (page, top) => {
        titleLines.forEach((line, index) => {
          const width = semibold.widthOfTextAtSize(line, titleSize);
          const y = top - titleSize * 1.12 * (index + 1) + titleSize * 0.12;

          page.drawText(line, {
            x: (A5_WIDTH_PT - width) / 2,
            y,
            size: titleSize,
            font: semibold,
            color: ink,
          });
        });
      },
    });

    blocks.push({
      height: dateHeight,
      gapBefore: mm(3.4 - 1.4) * scale,
      draw: (page, top) => {
        const width = regular.widthOfTextAtSize(input.dateLabel, dateSize);

        page.drawText(input.dateLabel, {
          x: (A5_WIDTH_PT - width) / 2,
          y: top - dateSize,
          size: dateSize,
          font: regular,
          color: ink,
        });
      },
    });

    if (logo) {
      const box = mm(logoSizeMm(input.logoSize)) * scale;
      const rounded = input.logoCorner === "rounded";

      blocks.push({
        height: box,
        gapBefore: mm(3.4) * scale,
        draw: (page, top) => {
          drawContained(page, logo, rounded ? box : contentWidth, box, top, rounded);
        },
      });
    }

    if (qr) {
      blocks.push({
        height: qrBox,
        gapBefore: mm(3.4 + 2.2) * scale,
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
      gapBefore: mm(3.4 + 1.4) * scale,
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

  let top = A5_HEIGHT_PT - padTop - (contentHeight - laid.height) / 2;

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
