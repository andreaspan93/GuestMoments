import { posterPngFilename, type QrDesign } from "@/lib/events/qr-design";

export function assertPosterDesign(shown: string | null | undefined, selected: QrDesign) {
  if (shown !== selected) {
    throw new Error("Poster export does not match the selected design.");
  }
}

function sameOrigin(src: string) {
  try {
    return new URL(src, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

function sourceSize(source: CanvasImageSource) {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }

  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return { width: source.width, height: source.height };
  }

  return { width: 0, height: 0 };
}

async function sourceFor(img: HTMLImageElement, eventId: string) {
  const asset = img.dataset.posterAsset;

  if (asset === "cover" || asset === "logo") {
    const response = await fetch(`/api/events/${eventId}/poster?asset=${asset}`, {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return createImageBitmap(await response.blob());
  }

  if (!sameOrigin(img.currentSrc || img.src)) {
    return null;
  }

  if (!img.complete || img.naturalWidth === 0) {
    try {
      await img.decode();
    } catch {
      return null;
    }
  }

  return img.naturalWidth > 0 ? img : null;
}

function drawFitted(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  box: DOMRect,
  origin: DOMRect,
  fit: string,
  radius: number,
) {
  const size = sourceSize(source);

  if (size.width <= 0 || size.height <= 0) {
    return;
  }

  const dx = box.left - origin.left;
  const dy = box.top - origin.top;
  ctx.save();

  if (radius >= Math.min(box.width, box.height) / 2 - 1) {
    ctx.beginPath();
    ctx.ellipse(dx + box.width / 2, dy + box.height / 2, box.width / 2, box.height / 2, 0, 0, Math.PI * 2);
    ctx.clip();
  }

  if (fit === "cover") {
    const scale = Math.max(box.width / size.width, box.height / size.height);
    const sw = box.width / scale;
    const sh = box.height / scale;
    ctx.drawImage(source, (size.width - sw) / 2, (size.height - sh) / 2, sw, sh, dx, dy, box.width, box.height);
  } else {
    const scale = Math.min(box.width / size.width, box.height / size.height);
    const width = size.width * scale;
    const height = size.height * scale;
    ctx.drawImage(source, dx + (box.width - width) / 2, dy + (box.height - height) / 2, width, height);
  }

  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, el: HTMLElement, origin: DOMRect) {
  const style = getComputedStyle(el);
  let text = el.innerText.replace(/\r/g, "");

  if (style.textTransform === "uppercase") {
    text = text.toLocaleUpperCase();
  } else if (style.textTransform === "lowercase") {
    text = text.toLocaleLowerCase();
  }

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);

  if (lines.length === 0) {
    return;
  }

  const box = el.getBoundingClientRect();
  const fontSize = Number.parseFloat(style.fontSize);
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.2;
  const tracking = style.letterSpacing === "normal" ? 0 : Number.parseFloat(style.letterSpacing) || 0;
  ctx.save();
  ctx.font = style.font;
  ctx.fillStyle = style.color;
  ctx.textBaseline = "middle";
  let y = box.top - origin.top + lineHeight / 2;

  for (const line of lines) {
    const chars = Array.from(line);
    const width =
      chars.reduce((sum, char) => sum + ctx.measureText(char).width, 0) +
      tracking * Math.max(0, chars.length - 1);
    let x = box.left - origin.left + (box.width - width) / 2;

    for (const char of chars) {
      ctx.fillText(char, x, y);
      x += ctx.measureText(char).width + tracking;
    }

    y += lineHeight;
  }

  ctx.restore();
}

async function renderPosterPng(node: HTMLElement) {
  const eventId = node.dataset.eventId ?? "";
  const images = [...node.querySelectorAll("img")];
  const bitmaps = new Map<HTMLImageElement, CanvasImageSource>();

  await Promise.all(
    images.map(async (img) => {
      const source = await sourceFor(img, eventId);

      if (source) {
        bitmaps.set(img, source);
      }
    }),
  );
  await document.fonts.ready;

  const origin = node.getBoundingClientRect();
  const scale = Math.min(4, Math.max(2, 1748 / Math.max(origin.width, 1)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(origin.width * scale));
  canvas.height = Math.max(1, Math.round(origin.height * scale));
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Poster PNG could not be created.");
  }

  ctx.scale(scale, scale);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, origin.width, origin.height);

  for (const rule of node.querySelectorAll<HTMLElement>(".qr-share-rule")) {
    const box = rule.getBoundingClientRect();
    ctx.fillStyle = getComputedStyle(rule).backgroundColor;
    ctx.fillRect(box.left - origin.left, box.top - origin.top, box.width, Math.max(box.height, 1));
  }

  for (const img of images) {
    const source = bitmaps.get(img);

    if (!source) {
      continue;
    }

    const frame = img.closest(".qr-poster-qr");

    if (frame) {
      const pad = frame.getBoundingClientRect();
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(pad.left - origin.left, pad.top - origin.top, pad.width, pad.height);
    }

    const style = getComputedStyle(img);
    const box = img.getBoundingClientRect();
    const rawRadius = style.borderTopLeftRadius || style.borderRadius;
    const radius = rawRadius.endsWith("%")
      ? (Number.parseFloat(rawRadius) / 100) * Math.min(box.width, box.height)
      : Number.parseFloat(rawRadius) || 0;
    drawFitted(ctx, source, box, origin, style.objectFit, radius);
  }

  for (const el of node.querySelectorAll<HTMLElement>("[data-poster-text]")) {
    drawText(ctx, el, origin);
  }

  for (const source of bitmaps.values()) {
    if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
      source.close();
    }
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((value) => resolve(value), "image/png");
  });

  if (!blob) {
    throw new Error("Poster PNG could not be created.");
  }

  return blob;
}

export async function downloadPosterPng(node: HTMLElement, design: QrDesign) {
  assertPosterDesign(node.dataset.qrDesign, design);
  const blob = await renderPosterPng(node);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = posterPngFilename(design);
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
