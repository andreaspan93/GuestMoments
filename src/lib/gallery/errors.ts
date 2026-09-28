export type GalleryErrorCode = "unauthorized" | "notFound" | "unavailable" | "oversize";

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

  if (code === "oversize") {
    return 413;
  }

  return 403;
}
