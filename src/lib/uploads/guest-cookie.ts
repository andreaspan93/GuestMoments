import { NextRequest, NextResponse } from "next/server";
import { createGuestToken } from "@/lib/uploads/token";
import { guestTokenCookieName, isGuestToken } from "@/lib/uploads/policy";

export function guestEventCode(pathname: string) {
  const match = /^\/e\/([^/]+)$/.exec(pathname);

  return match?.[1] ?? null;
}

const guestCookiePrefix = "gm_guest_";
const guestCookieMaxAge = 60 * 60 * 24 * 365;

function lockGuestCookie(
  response: NextResponse,
  name: string,
  value: string,
  maxAge = guestCookieMaxAge,
) {
  response.cookies.set({
    name,
    value,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  const code = name.startsWith(guestCookiePrefix) ? name.slice(guestCookiePrefix.length) : "";
  const legacyPaths = ["/e", code ? `/e/${code}` : ""].filter(Boolean);

  for (const path of legacyPaths) {
    response.headers.append(
      "set-cookie",
      `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`,
    );
  }
}

export function withGuestTokenCookie(request: NextRequest, response: NextResponse) {
  const code = guestEventCode(request.nextUrl.pathname);
  const currentName = code ? guestTokenCookieName(code) : null;

  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith(guestCookiePrefix) || cookie.name === currentName) {
      continue;
    }

    lockGuestCookie(
      response,
      cookie.name,
      isGuestToken(cookie.value) ? cookie.value : "",
      isGuestToken(cookie.value) ? guestCookieMaxAge : 0,
    );
  }

  if (!currentName) {
    return response;
  }

  const current = request.cookies.get(currentName)?.value;
  const value = current && isGuestToken(current) ? current : createGuestToken();
  lockGuestCookie(response, currentName, value);

  return response;
}
