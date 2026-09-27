export type UploadErrorCode =
  | "unauthorized"
  | "unavailable"
  | "notFound"
  | "type"
  | "oversize"
  | "quota"
  | "intent"
  | "rate"
  | "storage";

export class UploadError extends Error {
  readonly code: UploadErrorCode;

  constructor(code: UploadErrorCode) {
    super(code);
    this.code = code;
  }
}

export function uploadStatus(code: UploadErrorCode) {
  switch (code) {
    case "unauthorized":
      return 401;
    case "notFound":
      return 404;
    case "unavailable":
      return 403;
    case "type":
      return 415;
    case "oversize":
      return 413;
    case "rate":
      return 429;
    case "storage":
      return 503;
    default:
      return 409;
  }
}
