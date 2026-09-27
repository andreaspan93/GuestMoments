export function isHeic(file: File) {
  return (
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    /\.hei[cf]$/i.test(file.name)
  );
}

export async function normalizeUploadFile(file: File) {
  if (!isHeic(file)) {
    return file;
  }

  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({
    blob: file,
    toType: "image/jpeg",
    quality: 0.9,
  });
  const blob = Array.isArray(converted) ? converted[0] : converted;
  const name = file.name.replace(/\.hei[cf]$/i, ".jpg");

  return new File([blob], name.toLowerCase().endsWith(".jpg") ? name : `${name}.jpg`, {
    type: "image/jpeg",
  });
}

export async function createThumbnail(file: File) {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 480;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.8);
    });

    return blob;
  } catch {
    return null;
  }
}
