import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16">
      <section className="flex flex-1 flex-col justify-center rounded-3xl border border-border bg-card px-6 py-12 shadow-sm sm:px-12">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          {t("title")}
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-foreground/80">
          {t("lead")}
        </p>
      </section>
    </main>
  );
}
