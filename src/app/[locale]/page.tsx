import type { Metadata } from "next";
import Image from "next/image";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import "./landing.css";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const t = await getTranslations("landing");

  return (
    <main className="landing-hero" data-locale={locale}>
      <div className="landing-hero-media" aria-hidden="true">
        <Image
          src="/landing-hero.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="landing-hero-photo"
        />
        <div className="landing-hero-shade" />
      </div>
      <section className="landing-hero-copy">
        <p className="landing-hero-eyebrow">{t("eyebrow")}</p>
        <h1>{t("title")}</h1>
        <p className="landing-hero-lead">{t("lead")}</p>
      </section>
    </main>
  );
}
