import { randomBytes } from "node:crypto";

export function createEventCode() {
  return randomBytes(16).toString("base64url");
}

export function appOrigin() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function guestEventUrl(code: string) {
  return `${appOrigin()}/e/${code}`;
}
