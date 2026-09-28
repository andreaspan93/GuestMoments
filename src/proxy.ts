import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { isGuestEventPath, routing } from "./i18n/routing";
import { withGuestTokenCookie } from "./lib/uploads/guest-cookie";

const handleI18n = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (isGuestEventPath(request.nextUrl.pathname)) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-guest-event", "1");

    return withGuestTokenCookie(
      request,
      NextResponse.next({
        request: { headers: requestHeaders },
      }),
    );
  }

  return withGuestTokenCookie(request, handleI18n(request));
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
