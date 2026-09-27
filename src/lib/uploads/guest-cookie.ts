import { NextRequest, NextResponse } from "next/server";
import { createGuestToken } from "@/lib/uploads/token";
import { guestTokenCookieName, isGuestToken } from "@/lib/uploads/policy";

export function guestEventCode(pathname: string) {
  const match = /^\/e\/([^/]+)$/.exec(pathname);

  return match?.[1] ?? null;
}

export function withGuestTokenCookie(request: NextRequest, response: NextResponse) {
  const code = guestEventCode(request.nextUrl.pathname);

  if (!code) {
    return response;
  }

  const name = guestTokenCookieName(code);
  const current = request.cookies.get(name)?.value;

  if (current && isGuestToken(current)) {
    return response;
  }

  response.cookies.set({
    name,
    value: createGuestToken(),
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
