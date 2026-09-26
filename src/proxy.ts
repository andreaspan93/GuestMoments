import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { isGuestEventPath, routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

export function proxy(request: NextRequest) {
  if (isGuestEventPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  return handleI18n(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
