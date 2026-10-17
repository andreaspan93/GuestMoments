import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { CookieConsent } from "@/components/cookie-consent";
import { privacyCopy, privacyLanguage } from "@/content/privacy-copy";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { guestFontVariables } from "@/lib/events/guest-fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "GuestMoments",
  description:
    "Guests upload wedding photos and videos from their phones, without an account.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const jar = await cookies();
  const consent = parseConsent(jar.get(CONSENT_COOKIE)?.value);
  const guestQuery = headerStore.get("x-guest-locale");
  const guestLocale =
    guestQuery === "en" || guestQuery === "el"
      ? guestQuery
      : jar.get("guest-locale")?.value === "en"
        ? "en"
        : "el";
  const locale =
    headerStore.get("x-guest-event") === "1"
      ? guestLocale
      : (headerStore.get("x-next-intl-locale") ?? "el");
  const language = privacyLanguage(locale);

  return (
    <html lang={locale} className={`${guestFontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <CookieConsent copy={privacyCopy[language].consent} choice={consent} />
      </body>
    </html>
  );
}
