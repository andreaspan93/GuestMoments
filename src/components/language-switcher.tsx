"use client";

import { useLocale, useTranslations } from "next-intl";
import { LocaleFlag } from "@/components/locale-flag";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";

const labels = {
  el: "Ελληνικά",
  en: "English",
} as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations("landing");

  return (
    <nav
      aria-label={t("languageLabel")}
      className="inline-flex rounded-full border border-border bg-card p-0.5"
    >
      {routing.locales.map((item) => {
        const selected = item === locale;

        return (
          <Link
            key={item}
            href="/"
            locale={item}
            hrefLang={item}
            aria-label={labels[item]}
            title={labels[item]}
            aria-current={selected ? "true" : undefined}
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-full transition-colors",
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
