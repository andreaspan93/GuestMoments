"use server";

import { cookies } from "next/headers";
import { CONSENT_COOKIE, CONSENT_MAX_AGE_SECONDS, serializeConsent } from "@/lib/consent";

export async function saveConsentAction(preferences: boolean) {
  if (typeof preferences !== "boolean") {
    return;
  }

  const jar = await cookies();

  jar.set(CONSENT_COOKIE, serializeConsent(preferences), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CONSENT_MAX_AGE_SECONDS,
  });

  if (!preferences) {
    jar.set("NEXT_LOCALE", "", {
      path: "/",
      maxAge: 0,
      sameSite: "lax",
    });
    jar.set("guest-locale", "", {
      path: "/e",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
}
