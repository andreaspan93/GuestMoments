import { getLocale } from "next-intl/server";
import { CookieSettingsButton } from "@/components/cookie-settings-button";
import { Link } from "@/i18n/navigation";
import { legalRoutes, privacyCopy } from "@/content/privacy-copy";

const linkClassName =
  "text-sm tracking-wide text-[#f6f0e8]/90 transition-colors hover:text-[#e7c9a4]";

export async function SiteFooter() {
  const locale = await getLocale();
  const copy = locale === "el" ? privacyCopy.el : privacyCopy.en;

  return (
    <footer className="mt-16 bg-[#2c241f] text-[#f6f0e8] print:hidden">
      <div className="mx-auto grid w-full max-w-5xl gap-10 px-6 py-14 sm:px-10 md:grid-cols-2 md:items-start md:gap-16">
        <div className="max-w-md">
          <p className="font-display text-4xl leading-none font-semibold tracking-tight">
            Guest Moments
          </p>
          <p className="mt-5 text-sm leading-7 text-[#f6f0e8]/75">{copy.footerLead}</p>
        </div>
        <nav aria-label={copy.footerLabel} className="md:justify-self-end">
          <p className="text-xs font-medium tracking-[0.18em] text-[#e7c9a4] uppercase">
            {copy.footerLabel}
          </p>
          <ul className="mt-5 grid gap-3">
            {legalRoutes.map((route) => (
              <li key={route.slug}>
                <Link href={route.href} className={linkClassName}>
                  {copy.nav[route.slug]}
                </Link>
              </li>
            ))}
            <li>
              <CookieSettingsButton label={copy.nav.cookieSettings} className={linkClassName} />
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
