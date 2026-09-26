"use client";

import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
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
    <nav aria-label={t("languageLabel")} className="flex gap-2">
      {routing.locales.map((item) => (
        <Link
          key={item}
          href="/"
          locale={item}
          hrefLang={item}
          className={cn(
            buttonVariants({
              variant: item === locale ? "default" : "outline",
              size: "sm",
            }),
          )}
          aria-current={item === locale ? "true" : undefined}
        >
          {labels[item]}
        </Link>
      ))}
    </nav>
  );
}
