import { createHmac, timingSafeEqual } from "node:crypto";

export function storageSignature(input: {
  method: "PUT" | "GET";
  key: string;
  contentType: string;
  contentLength: string;
  expiresAt: number;
  secret: string;
}) {
  const payload = [
    input.method,
    input.key,
    input.contentType,
    input.contentLength,
    String(input.expiresAt),
  ].join("\n");

  return createHmac("sha256", input.secret).update(payload).digest("base64url");
}

export function storageSignatureMatches(
  expected: string,
  provided: string | null,
) {
  if (!provided) {
    return false;
  }

  const left = Buffer.from(expected);
  const right = Buffer.from(provided);

  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}
