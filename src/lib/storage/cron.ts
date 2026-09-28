import { createHash, timingSafeEqual } from "node:crypto";

export function cronAuthorized(authorization: string | null, secret: string | undefined) {
  if (!secret) {
    return false;
  }

  const provided = createHash("sha256")
    .update(authorization ?? "")
    .digest();
  const expected = createHash("sha256")
    .update(`Bearer ${secret}`)
    .digest();

  return timingSafeEqual(provided, expected);
}
