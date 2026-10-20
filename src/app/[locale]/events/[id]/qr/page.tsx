import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { PrintButton } from "@/components/print-button";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { buttonVariants } from "@/components/ui/button";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { eventFontFamily, eventFontWeight, logoImageClass } from "@/lib/events/appearance";
import { POSTER_TOP_FREE_SHARE, posterFrameStyle } from "@/lib/events/poster-layout";
import { posterTitleSize } from "@/lib/events/poster-title";
import { guestEventUrl } from "@/lib/events/code";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { getCustomerEvent } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";
import { signedObjectUrl } from "@/lib/storage/links";

function EventLogo({ src, className }: { src: string | null; className: string }) {
  if (!src) {
    return null;
  }

  return (
    // Signed storage URL; the image optimizer is not used.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={className} />
  );
}

export default async function EventQrPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }

  const event = await getCustomerEvent(session.user, id);

  if (!event) {
    notFound();
  }

  const t = await getTranslations("events");
  const url = guestEventUrl(event.uniqueCode);
  const [coverUrl, logoUrl] = await Promise.all([
    signedObjectUrl(event.coverKey),
    signedObjectUrl(event.logoKey),
  ]);
  const qrSrc = `/api/events/${event.id}/qr`;
  const posterClass = logoUrl ? "qr-poster qr-poster-has-logo" : "qr-poster";

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pt-2 text-center print:hidden sm:px-6">
        <ServiceAccessNotice user={session.user} />
        <p className="max-w-xl text-sm leading-6 text-foreground/80">{t("qrLead")}</p>
      </div>
      <div className="qr-poster-stage">
        <div className="qr-poster-scale">
          <article className={posterClass} style={posterFrameStyle() as CSSProperties}>
            <div className="qr-poster-sheet">
              <div className="qr-poster-balance" style={{ flexGrow: POSTER_TOP_FREE_SHARE }} aria-hidden="true" />
              <h1
                className="qr-poster-title"
                style={{
                  fontFamily: eventFontFamily(event.titleFont),
                  fontSize: posterTitleSize(event.name, event.titleFont),
                  fontWeight: eventFontWeight(event.titleFont),
                }}
              >
                {event.name}
              </h1>
              <p className="qr-poster-date">
                {formatCalendarDate(calendarDateFromDb(event.eventDate), locale)}
              </p>
              {coverUrl ? (
                // Signed storage URL; the image optimizer is not used.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="qr-poster-cover" src={coverUrl} alt="" />
              ) : null}
              {logoUrl ? (
                <div className="qr-poster-logo">
                  <EventLogo
                    src={logoUrl}
                    className={logoImageClass(event.logoSize, event.logoCorner, "print")}
                  />
                </div>
              ) : null}
              <div className="qr-poster-qr">
                {/* Generated locally; the image optimizer is not used. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt={t("qrAlt")} width={512} height={512} />
              </div>
              <p className="qr-poster-cta">{t("qrPosterCta")}</p>
              <div
                className="qr-poster-balance"
                style={{ flexGrow: 1 - POSTER_TOP_FREE_SHARE }}
                aria-hidden="true"
              />
            </div>
          </article>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-16 text-center print:hidden sm:px-6">
        <p className="max-w-md break-all font-mono text-sm">{url}</p>
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
          <a
            href={`/api/events/${event.id}/qr?download=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("downloadQr")}
          </a>
          <a
            href={`/api/events/${event.id}/poster?locale=${locale}`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("downloadA5")}
          </a>
          <PrintButton label={t("print")} />
        </div>
      </div>
    </>
  );
}
