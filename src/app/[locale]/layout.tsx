import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { routing } from "@/i18n/routing";
import { getRequestSession, rememberPreferredLocale } from "@/lib/session";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const session = await getRequestSession();

  if (session) {
    await rememberPreferredLocale(
      session.user.id,
      locale,
      session.user.preferredLocale,
    );
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <SiteHeader />
      {children}
    </NextIntlClientProvider>
  );
}
