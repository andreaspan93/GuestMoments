import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LegalDocumentView } from "@/components/legal-document";
import { privacyCopy, privacyLanguage, type LegalSlug } from "@/content/privacy-copy";
import { routing } from "@/i18n/routing";

export function legalMetadata(slug: LegalSlug) {
  return async function generateMetadata({
    params,
  }: {
    params: Promise<{ locale: string }>;
  }): Promise<Metadata> {
    const { locale } = await params;
    const document = privacyCopy[privacyLanguage(locale)].documents[slug];

    return {
      title: document.title,
      description: document.description,
    };
  };
}

export function legalPage(slug: LegalSlug) {
  return async function LegalRoute({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;

    if (!hasLocale(routing.locales, locale)) {
      notFound();
    }

    setRequestLocale(locale);

    return <LegalDocumentView locale={locale} slug={slug} />;
  };
}
