import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { QrDesignPanel } from "@/components/qr-design-panel";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { eventFontFamily, eventFontWeight } from "@/lib/events/appearance";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { posterTitleSize } from "@/lib/events/poster-title";
import { sharePosterDate } from "@/lib/events/qr-design";
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
          titleFamily: eventFontFamily(event.titleFont),
          titleSize: posterTitleSize(event.name, event.titleFont),
          titleWeight: eventFontWeight(event.titleFont),
          logoSize: event.logoSize,
          logoCorner: event.logoCorner,
          dateLabel: formatCalendarDate(calendarDateFromDb(event.eventDate), locale),
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
