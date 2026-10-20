/**
 * Longest side kept for a guest photo.
 * A 12 MP phone photo is about 4032px on the long side, so it is recompressed
 * and not resampled. Larger camera files, around 8000px, are reduced to 4096px.
 * That still fills a 4K screen and leaves a usable download, while cutting
 * those larger files to about a quarter of their pixels.
 */
export const MAX_IMAGE_EDGE = 4096;

export const JPEG_QUALITY = 0.8;

export type JpegMetadata = {
  orientation: number;
  width: number | null;
  height: number | null;
};

export function jpegFileName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const stem = base.replace(/\.[^.]+$/, "").trim() || "photo";

  return `${stem.slice(0, 176)}.jpg`;
}

export function isVideoFile(file: { type: string; name: string }) {
  return file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name);
}

export function isHeicFile(file: { type: string; name: string }) {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

export function isBrowserRaster(file: { type: string; name: string }) {
  return (
    file.type === "image/jpeg" ||
    file.type === "image/png" ||
    file.type === "image/webp" ||
    (file.type === "" && /\.(jpe?g|png|webp)$/i.test(file.name))
  );
}

export function isJpegBytes(bytes: Uint8Array) {
  return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export function outputPixelSize(
  sourceWidth: number,
  sourceHeight: number,
  orientation: number,
  maxEdge = MAX_IMAGE_EDGE,
) {
  const turns = orientation >= 5 && orientation <= 8;
  const width = Math.max(0, turns ? sourceHeight : sourceWidth);
  const height = Math.max(0, turns ? sourceWidth : sourceHeight);
  const longest = Math.max(width, height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;

  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function drawSize(sourceWidth: number, sourceHeight: number, scale: number) {
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

/** Canvas transform that maps stored pixels onto the oriented display canvas. */
export function orientationMatrix(
  orientation: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  switch (orientation) {
    case 2:
      return [-1, 0, 0, 1, canvasWidth, 0] as const;
    case 3:
      return [-1, 0, 0, -1, canvasWidth, canvasHeight] as const;
    case 4:
      return [1, 0, 0, -1, 0, canvasHeight] as const;
    case 5:
      return [0, 1, 1, 0, 0, 0] as const;
    case 6:
      return [0, 1, -1, 0, canvasWidth, 0] as const;
    case 7:
      return [0, -1, -1, 0, canvasWidth, canvasHeight] as const;
    case 8:
      return [0, -1, 1, 0, 0, canvasHeight] as const;
    default:
      return [1, 0, 0, 1, 0, 0] as const;
  }
}

export function imageHasTransparency(pixels: Uint8ClampedArray) {
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] !== 255) {
      return true;
    }
  }

  return false;
}

export function effectiveOrientation(
  metadata: JpegMetadata,
  bitmapWidth: number,
  bitmapHeight: number,
  decodedWithoutOrientation: boolean,
) {
  if (!decodedWithoutOrientation || metadata.orientation <= 1) {
    return 1;
  }

  const swapped = metadata.orientation >= 5 && metadata.orientation <= 8;

  if (
    swapped &&
    metadata.width !== null &&
    metadata.height !== null &&
    bitmapWidth === metadata.height &&
    bitmapHeight === metadata.width
  ) {
    return 1;
  }

  return metadata.orientation;
}

export function readJpegMetadata(bytes: Uint8Array): JpegMetadata {
  const result: JpegMetadata = { orientation: 1, width: null, height: null };

  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    return result;
  }

  let offset = 2;

  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xff) {
      offset += 1;
      continue;
    }

    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];

    if (length < 2 || offset + 2 + length > bytes.length) {
      break;
    }

    const start = offset + 4;
    const payload = length - 2;

    if (marker === 0xe1) {
      const orientation = exifOrientation(bytes, start, payload);

      if (orientation >= 1 && orientation <= 8) {
        result.orientation = orientation;
      }
    }

    if ((marker === 0xc0 || marker === 0xc1 || marker === 0xc2) && payload >= 5) {
      result.height = (bytes[start + 1] << 8) | bytes[start + 2];
      result.width = (bytes[start + 3] << 8) | bytes[start + 4];
    }

    offset += 2 + length;
  }

  return result;
}

function exifOrientation(bytes: Uint8Array, start: number, length: number) {
  if (
    length < 16 ||
    bytes[start] !== 0x45 ||
    bytes[start + 1] !== 0x78 ||
    bytes[start + 2] !== 0x69 ||
    bytes[start + 3] !== 0x66 ||
    bytes[start + 4] !== 0 ||
    bytes[start + 5] !== 0
  ) {
    return 0;
  }

  const tiff = start + 6;
  const end = start + length;
  const little = bytes[tiff] === 0x49 && bytes[tiff + 1] === 0x49;
  const big = bytes[tiff] === 0x4d && bytes[tiff + 1] === 0x4d;

  if ((!little && !big) || tiff + 8 > end) {
    return 0;
  }

  const read16 = (pos: number) => {
    if (pos + 2 > end) {
      return 0;
    }

    return little ? bytes[pos] | (bytes[pos + 1] << 8) : (bytes[pos] << 8) | bytes[pos + 1];
  };
  const read32 = (pos: number) => {
    if (pos + 4 > end) {
      return 0;
    }

    return little
      ? (bytes[pos] |
          (bytes[pos + 1] << 8) |
          (bytes[pos + 2] << 16) |
          (bytes[pos + 3] << 24)) >>>
          0
      : (bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3];
  };

  if (read16(tiff + 2) !== 0x002a) {
    return 0;
  }

  const ifd = tiff + read32(tiff + 4);

  if (ifd + 2 > end) {
    return 0;
  }

  const count = read16(ifd);

  for (let index = 0; index < count; index += 1) {
    const entry = ifd + 2 + index * 12;

    if (entry + 12 > end) {
      return 0;
    }

    if (read16(entry) === 0x0112) {
      return read16(entry + 8);
    }
  }

  return 0;
}
