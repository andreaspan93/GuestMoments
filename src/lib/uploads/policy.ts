import { randomUUID } from "node:crypto";

const PHOTO_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

const VIDEO_EXTENSIONS: Record<string, readonly string[]> = {
  "video/mp4": ["mp4"],
  "video/quicktime": ["mov"],
};

const storageKeyPattern =
  /^events\/[0-9a-f-]{36}\/(?:originals|thumbnails)\/[0-9a-f-]{36}$|^events\/[0-9a-f-]{36}\/branding\/(?:cover|logo|background)-[0-9a-f-]{36}$/;

export function classifyUpload(contentType: string, fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (PHOTO_EXTENSIONS[contentType]?.includes(extension)) {
    return "photo" as const;
  }

  if (VIDEO_EXTENSIONS[contentType]?.includes(extension)) {
    return "video" as const;
  }

  return null;
}

export function exceedsUploadCap(
  kind: "photo" | "video",
  size: bigint,
  caps: { photo: bigint; video: bigint },
) {
  if (size <= BigInt(0)) {
    return true;
  }

  return size > (kind === "photo" ? caps.photo : caps.video);
}

export function sanitizeFileName(value: string) {
  const base = value.split(/[/\\]/).pop() ?? "";
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();

  return cleaned.slice(0, 180) || "upload";
}

export function isStorageKey(key: string) {
  return storageKeyPattern.test(key);
}

export function originalObjectKey(eventId: string) {
  return `events/${eventId}/originals/${randomUUID()}`;
}

export function thumbnailObjectKey(eventId: string) {
  return `events/${eventId}/thumbnails/${randomUUID()}`;
}

export function brandingObjectKey(
  eventId: string,
  slot: "cover" | "logo" | "background",
) {
  return `events/${eventId}/branding/${slot}-${randomUUID()}`;
}

export function eventStoragePrefix(eventId: string) {
  return `events/${eventId}/`;
}

export function keysMatch(intentKey: string, claimedKey: string | undefined) {
  if (claimedKey === undefined) {
    return true;
  }

  return claimedKey === intentKey;
}

const guestTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function isGuestToken(value: string) {
  return guestTokenPattern.test(value);
}

export function guestTokenCookieName(code: string) {
  return `gm_guest_${code}`;
}

export function guestTokenFromRequest(
  cookieValue: string | undefined,
  bodyToken: unknown,
) {
  void bodyToken;

  if (!cookieValue || !isGuestToken(cookieValue)) {
    return null;
  }

  return cookieValue;
}
