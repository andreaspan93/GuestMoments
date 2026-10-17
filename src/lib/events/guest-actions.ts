"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { guestLocaleFromCookie, type GuestLocale } from "@/lib/events/text";

const cookieName = "guest-locale";
const eventCodePattern = /^[A-Za-z0-9_-]{8,128}$/;

export async function readGuestLocale(): Promise<GuestLocale> {
  const jar = await cookies();

  return guestLocaleFromCookie(jar.get(cookieName)?.value);
}

export async function setGuestLocale(locale: GuestLocale, formData: FormData) {
  const nextLocale = locale === "en" ? "en" : "el";
  const code = formData.get("code");

  if (typeof code !== "string" || !eventCodePattern.test(code)) {
    return;
  }

  const jar = await cookies();

  jar.set(cookieName, nextLocale, {
    path: "/e",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect(`/e/${code}?hl=${nextLocale}`);
}
