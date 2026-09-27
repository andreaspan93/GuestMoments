"use server";

import { cookies } from "next/headers";
import { guestLocaleFromCookie, type GuestLocale } from "@/lib/events/text";

const cookieName = "guest-locale";

export async function readGuestLocale(): Promise<GuestLocale> {
  const jar = await cookies();

  return guestLocaleFromCookie(jar.get(cookieName)?.value);
}

export async function setGuestLocale(locale: GuestLocale) {
  const nextLocale = locale === "en" ? "en" : "el";
  const jar = await cookies();

  jar.set(cookieName, nextLocale, {
    path: "/e",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
}
