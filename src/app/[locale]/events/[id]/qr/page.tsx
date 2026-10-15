import type { CSSProperties } from "react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { buttonVariants } from "@/components/ui/button";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { eventFontFamily, logoImageClass, posterTitleSize } from "@/lib/events/appearance";
import { guestEventUrl } from "@/lib/events/code";
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
  const logoUrl = await signedObjectUrl(event.logoKey);
  const qrSrc = `/api/events/${event.id}/qr`;
  const posterStyle = { "--poster-accent": event.accentColor } as CSSProperties;

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pt-2 text-center print:hidden sm:px-6">
        <ServiceAccessNotice user={session.user} />
        <p className="max-w-xl text-sm leading-6 text-foreground/80">{t("qrLead")}</p>
      </div>
      <div className="qr-poster-stage">
        <div className="qr-poster-scale">
          <article className="qr-poster" style={posterStyle}>
            <div className="qr-poster-frame">
              <h1
                className="qr-poster-title"
                style={{
                  fontFamily: eventFontFamily(event.titleFont),
                  fontSize: posterTitleSize(event.name),
                }}
              >
                {event.name}
              </h1>
              <div className="qr-poster-ornament" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <EventLogo
                src={logoUrl}
                className={logoImageClass(event.logoSize, event.logoCorner, "print")}
              />
              <div className="qr-poster-qr">
                {/* Generated locally; the image optimizer is not used. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrSrc} alt={t("qrAlt")} width={512} height={512} />
              </div>
              <p className="qr-poster-cta">{t("qrPosterCta")}</p>
            </div>
          </article>
        </div>
      </div>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-4 pb-16 text-center print:hidden sm:px-6">
        <p className="max-w-md break-all font-mono text-sm">{url}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={`/api/events/${event.id}/qr?download=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("downloadQr")}
          </a>
          <PrintButton label={t("print")} />
        </div>
      </div>
    </>
  );
}
