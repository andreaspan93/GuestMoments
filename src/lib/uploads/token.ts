import { randomBytes } from "node:crypto";

export function createGuestToken() {
  return randomBytes(32).toString("base64url");
}
