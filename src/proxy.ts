import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { isGuestEventPath, routing } from "./i18n/routing";
import { CONSENT_COOKIE, preferenceCookiesToClear } from "./lib/consent";
import { withGuestTokenCookie } from "./lib/uploads/guest-cookie";

const handleI18n = createMiddleware(routing);

function applyConsentCookiePolicy(request: NextRequest, response: NextResponse) {
  for (const cookie of preferenceCookiesToClear(request.cookies.get(CONSENT_COOKIE)?.value)) {
    response.cookies.set({
      name: cookie.name,
      value: "",
      path: cookie.path,
      maxAge: 0,
      sameSite: "lax",
      ...(cookie.name === "guest-locale"
        ? { httpOnly: true, secure: process.env.NODE_ENV === "production" }
        : {}),
    });
  }

  return response;
}

export function proxy(request: NextRequest) {
  if (isGuestEventPath(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-guest-event", "1");
    const hl = request.nextUrl.searchParams.get("hl");

    if (hl === "en" || hl === "el") {
      requestHeaders.set("x-guest-locale", hl);
    }

    return applyConsentCookiePolicy(
      request,
      withGuestTokenCookie(
        request,
        NextResponse.next({
          request: { headers: requestHeaders },
        }),
      ),
    );
  }

  return applyConsentCookiePolicy(request, withGuestTokenCookie(request, handleI18n(request)));
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
