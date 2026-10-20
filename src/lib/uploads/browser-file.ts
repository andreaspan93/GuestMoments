import {
  JPEG_QUALITY,
  drawSize,
  effectiveOrientation,
  imageHasTransparency,
  isBrowserRaster,
  isHeicFile,
  isJpegBytes,
  isVideoFile,
  jpegFileName,
  orientationMatrix,
  outputPixelSize,
  readJpegMetadata,
} from "@/lib/uploads/image-prepare";

export { isHeicFile as isHeic };

const HEIC_DECODE_QUALITY = 0.92;

export async function prepareGuestUpload(file: File) {
  if (isVideoFile(file)) {
    return file;
  }

  if (isHeicFile(file)) {
    const decoded = await decodeHeic(file);

    return (await encodeJpeg(decoded)) ?? decoded;
  }

  if (!isBrowserRaster(file)) {
    return file;
  }

  return (await encodeJpeg(file)) ?? file;
}

export const normalizeUploadFile = prepareGuestUpload;

async function decodeHeic(file: File) {
  try {
    const heic2any = (await import("heic2any")).default;
    const converted = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: HEIC_DECODE_QUALITY,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;

    if (!blob || blob.size === 0) {
      throw new Error("type");
    }

    return new File([blob], jpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "type") {
      throw error;
    }

    throw new Error("type");
  }
}

async function encodeJpeg(file: File) {
  let bitmap: ImageBitmap | null = null;

  try {
    const header = new Uint8Array(await file.slice(0, 512 * 1024).arrayBuffer());
    const metadata = readJpegMetadata(header);
    let decodedWithoutOrientation = true;

    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "none" });
    } catch {
      decodedWithoutOrientation = false;
      bitmap = await createImageBitmap(file);
    }

    const orientation = effectiveOrientation(
      metadata,
      bitmap.width,
      bitmap.height,
      decodedWithoutOrientation,
    );
    const output = outputPixelSize(bitmap.width, bitmap.height, orientation);
    const drawn = drawSize(bitmap.width, bitmap.height, output.scale);
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.save();
    const [a, b, c, d, e, f] = orientationMatrix(orientation, output.width, output.height);
    context.transform(a, b, c, d, e, f);
    context.drawImage(bitmap, 0, 0, drawn.width, drawn.height);
    context.restore();

    if (file.type === "image/png" || file.type === "image/webp" || /\.(png|webp)$/i.test(file.name)) {
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

      if (imageHasTransparency(pixels)) {
        return null;
      }
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    if (!blob) {
      return null;
    }

    const signature = new Uint8Array(await blob.slice(0, 3).arrayBuffer());

    if (!isJpegBytes(signature)) {
      return null;
    }

    return new File([blob], jpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function createThumbnail(file: File) {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  let bitmap: ImageBitmap | null = null;

  try {
    try {
      bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      bitmap = await createImageBitmap(file);
    }

    const maxEdge = 480;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
    });

    return blob;
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}
