export type GalleryErrorCode = "unauthorized" | "notFound" | "unavailable";

export class GalleryError extends Error {
  readonly code: GalleryErrorCode;

  constructor(code: GalleryErrorCode) {
    super(code);
    this.code = code;
  }
}

export function galleryStatus(code: GalleryErrorCode) {
  if (code === "unauthorized") {
    return 401;
  }

  if (code === "notFound") {
    return 404;
  }

  return 403;
}
