import { getLocale } from "next-intl/server";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { legalRoutes, privacyCopy, privacyLanguage } from "@/content/privacy-copy";
import { Link } from "@/i18n/navigation";

export async function SiteFooter() {
  const copy = privacyCopy[privacyLanguage(await getLocale())];

  return (
    <footer className="mt-auto border-t border-border print:hidden">
      <nav
        aria-label={copy.footerLabel}
        className="mx-auto flex w-full max-w-3xl flex-wrap gap-x-4 gap-y-2 px-6 py-8 text-sm text-foreground/80"
      >
        {legalRoutes.map((route) => (
          <Link key={route.slug} href={route.href} className="underline underline-offset-4">
            {copy.nav[route.slug]}
          </Link>
        ))}
        <CookieSettingsButton label={copy.nav.cookieSettings} />
      </nav>
    </footer>
  );
}
