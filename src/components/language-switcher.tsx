"use client";

import { Suspense } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { LocaleFlag } from "@/components/locale-flag";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const labels = {
  el: "Ελληνικά",
  en: "English",
} as const;

function LanguageSwitcherLinks({ href }: { href: string }) {
  const locale = useLocale();
  const t = useTranslations("landing");

  return (
    <nav
      aria-label={t("languageLabel")}
      className="inline-flex rounded-full border border-border bg-card p-px min-[340px]:p-0.5"
    >
      {routing.locales.map((item) => {
        const selected = item === locale;

        return (
          <Link
            key={item}
            href={href}
            locale={item}
            hrefLang={item}
            aria-label={labels[item]}
            title={labels[item]}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-full transition-colors min-[340px]:size-8",
              selected ? "bg-muted ring-1 ring-primary" : "hover:bg-muted/80",
            )}
          >
            <LocaleFlag locale={item} />
            <span className="sr-only">{labels[item]}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LanguageSwitcherWithQuery() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();

  return <LanguageSwitcherLinks href={query ? `${pathname}?${query}` : pathname} />;
}

export function LanguageSwitcher() {
  const pathname = usePathname();

  return (
    <Suspense fallback={<LanguageSwitcherLinks href={pathname} />}>
      <LanguageSwitcherWithQuery />
    </Suspense>
  );
}
