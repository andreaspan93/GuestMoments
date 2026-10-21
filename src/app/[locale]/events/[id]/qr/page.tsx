import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { QrDesignPanel } from "@/components/qr-design-panel";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { posterTextSizes } from "@/lib/events/poster-title";
import { resolvePosterTypography } from "@/lib/events/poster-typography";
import { sharePosterCopy, sharePosterDate } from "@/lib/events/qr-design";
import { getCustomerEvent } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";
import { signedObjectUrl } from "@/lib/storage/links";

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

  const posterLocale = locale === "en" ? "en" : "el";
  const typography = resolvePosterTypography(event.posterTypography);
  const dateLabel = formatCalendarDate(calendarDateFromDb(event.eventDate), locale);
  const copy = sharePosterCopy(posterLocale);
  const [coverUrl, logoUrl] = await Promise.all([
    signedObjectUrl(event.coverKey),
    signedObjectUrl(event.logoKey),
  ]);
  const qrSrc = `/api/events/${event.id}/qr`;

  return (
    <>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center self-center px-4 pt-2 print:hidden sm:px-6">
        <ServiceAccessNotice user={session.user} />
      </div>
      <QrDesignPanel
        event={{
          id: event.id,
          name: event.name,
          typography,
          sizes: posterTextSizes(typography, {
            name: event.name,
            date: dateLabel,
            kicker: copy.kicker,
            script: copy.script,
          }),
          logoSize: event.logoSize,
          logoCorner: event.logoCorner,
          dateLabel,
          shareDate: sharePosterDate(calendarDateFromDb(event.eventDate), posterLocale),
        }}
        locale={posterLocale}
        coverUrl={coverUrl}
        logoUrl={logoUrl}
        qrSrc={qrSrc}
      />
    </>
  );
}
