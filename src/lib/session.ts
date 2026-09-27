import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { preferredLocaleFromPage } from "@/lib/identity-schema";
import { prisma } from "@/lib/prisma";

type HeaderSource = {
  get(name: string): string | null;
};

function toHeaders(source: HeaderSource) {
  if (source instanceof Headers) {
    return source;
  }

  const nextHeaders = new Headers();
  const cookie = source.get("cookie");

  if (cookie) {
    nextHeaders.set("cookie", cookie);
  }

  return nextHeaders;
}

export async function getActiveSession(source: HeaderSource) {
  const cookie = source.get("cookie") ?? "";

  if (!cookie.includes("session_token")) {
    return null;
  }

  const requestHeaders = toHeaders(source);
  const session = await auth.api.getSession({
    headers: requestHeaders,
  });

  if (!session) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      disabled: true,
      preferredLocale: true,
    },
  });

  if (!user || user.disabled) {
    await prisma.session.deleteMany({
      where: { userId: session.user.id },
    });

    try {
      await auth.api.signOut({
        headers: requestHeaders,
      });
    } catch {
      // Clearing the cookie needs a Next.js request. The session rows are already gone.
    }

    return null;
  }

  return {
    session: session.session,
    user,
  };
}

export const getRequestSession = cache(async () => {
  return getActiveSession(await headers());
});

export async function rememberPreferredLocale(
  userId: string,
  pageLocale: string,
  currentLocale: string,
) {
  const preferredLocale = preferredLocaleFromPage(pageLocale);

  if (currentLocale === preferredLocale) {
    return;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { preferredLocale },
  });
}
