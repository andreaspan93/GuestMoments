import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { customerNotice } from "@/lib/access";
import { BrandingUploads } from "@/components/branding-uploads";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { DeleteEventButton } from "@/components/delete-event-button";
import { EventForm } from "@/components/event-form";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  calendarDateFromDb,
  formatAthensDateTime,
} from "@/lib/events/expiry";
import { getCustomerEvent } from "@/lib/events/service";
import { signedObjectUrl } from "@/lib/storage/links";
import { getRequestSession } from "@/lib/session";

export default async function EditEventPage({
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
  const [cover, logo, background] = await Promise.all([
    signedObjectUrl(event.coverKey),
    signedObjectUrl(event.logoKey),
    signedObjectUrl(event.backgroundImageKey),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16">
      <section className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{t("editTitle")}</h1>
            <p className="mt-3 text-sm text-foreground/80">
              {t("expires")} {formatAthensDateTime(event.expiresAt, locale)}
            </p>
          </div>
          <div className="flex gap-4">
            <Link href={`/events/${event.id}/gallery`} className="text-sm text-primary underline-offset-4 hover:underline">
              {t("gallery")}
            </Link>
            <Link href={`/events/${event.id}/qr`} className="text-sm text-primary underline-offset-4 hover:underline">
              {t("qr")}
            </Link>
          </div>
        </div>
        {customerNotice(session.user, new Date()) ? (
          <div className="mt-8">
            <ServiceAccessNotice user={session.user} />
          </div>
        ) : (
        <>
        <div className="mt-8 max-w-xl">
          <EventForm
            eventId={event.id}
            defaults={{
              name: event.name,
              eventDate: calendarDateFromDb(event.eventDate),
              welcomeMessageEl: event.welcomeMessageEl,
              welcomeMessageEn: event.welcomeMessageEn,
              uploadInstructionsEl: event.uploadInstructionsEl,
              uploadInstructionsEn: event.uploadInstructionsEn,
              backgroundColor: event.backgroundColor,
              accentColor: event.accentColor,
              privacyMode:
                event.privacyMode === "OWN_UPLOADS" ? "OWN_UPLOADS" : "FULL_GALLERY",
              status: event.status === "DISABLED" ? "DISABLED" : "ACTIVE",
            }}
          />
        </div>
        <BrandingUploads
          eventId={event.id}
          previews={{ cover, logo, background }}
        />
        <div className="mt-8">
          <DeleteEventButton
            eventId={event.id}
            label={t("delete")}
            confirm={t("deleteConfirm")}
          />
        </div>
        </>
        )}
      </section>
    </main>
  );
}
