export const GALLERY_PREVIEW_SECONDS = 15 * 60;
export const GALLERY_DOWNLOAD_SECONDS = 60;
export const GALLERY_REFRESH_MS = 15_000;
export const BULK_DOWNLOAD_MAX_BYTES = BigInt(200) * BigInt(1024) * BigInt(1024);

export type GalleryItem = {
  id: string;
  type: "photo" | "video";
  mimeType: string;
  originalFileName: string;
  size: string;
  guestName: string;
  guestMessage: string;
  createdAt: string;
  previewUrl: string | null;
  playbackUrl: string | null;
};

export type CustomerGalleryItem = GalleryItem & {
  isHidden: boolean;
  isFavorite: boolean;
  albumId: string | null;
};

export type AlbumSummary = {
  id: string;
  name: string;
};

type GallerySource = {
  id: string;
  type: string;
  mimeType: string;
  originalFileName: string;
  size: bigint;
  guestName: string;
  guestMessage: string;
  createdAt: Date;
  isHidden: boolean;
  isFavorite: boolean;
  albumId: string | null;
};

export function mediaKind(type: string) {
  if (type === "VIDEO" || type === "video") {
    return "video" as const;
  }

  if (type === "PHOTO" || type === "photo") {
    return "photo" as const;
  }

  return null;
}

export function formatStorage(bytes: bigint) {
  if (bytes <= BigInt(0)) {
    return "0 MB";
  }

  const megabytes = Number(bytes) / (1024 * 1024);

  if (megabytes < 10) {
    const rounded = Math.round(megabytes * 10) / 10;

    return `${rounded} MB`;
  }

  return `${Math.round(megabytes)} MB`;
}

export function toGalleryItem(
  row: GallerySource,
  urls: { previewUrl: string | null; playbackUrl: string | null },
): GalleryItem {
  const type = mediaKind(row.type) ?? "photo";

  return {
    id: row.id,
    type,
    mimeType: row.mimeType,
    originalFileName: row.originalFileName,
    size: row.size.toString(),
    guestName: row.guestName,
    guestMessage: row.guestMessage,
    createdAt: row.createdAt.toISOString(),
    previewUrl: urls.previewUrl,
    playbackUrl: urls.playbackUrl,
  };
}

export function toCustomerGalleryItem(
  row: GallerySource,
  urls: { previewUrl: string | null; playbackUrl: string | null },
): CustomerGalleryItem {
  return {
    ...toGalleryItem(row, urls),
    isHidden: row.isHidden,
    isFavorite: row.isFavorite,
    albumId: row.albumId,
  };
}

export function exceedsBulkCap(totalBytes: bigint) {
  return totalBytes > BULK_DOWNLOAD_MAX_BYTES;
}

export function uniqueZipNames(fileNames: string[]) {
  const seen = new Map<string, number>();

  return fileNames.map((fileName) => {
    const safe = sanitizedZipName(fileName);
    const count = seen.get(safe) ?? 0;
    seen.set(safe, count + 1);

    if (count === 0) {
      return safe;
    }

    const dot = safe.lastIndexOf(".");
    const suffix = ` (${count + 1})`;

    if (dot <= 0) {
      return `${safe}${suffix}`;
    }

    return `${safe.slice(0, dot)}${suffix}${safe.slice(dot)}`;
  });
}

function sanitizedZipName(fileName: string) {
  const base = fileName.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();

  return cleaned.slice(0, 180) || "file";
}
