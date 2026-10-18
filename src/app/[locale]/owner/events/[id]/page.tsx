import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { OwnerDeleteButton } from "@/components/owner-delete-button";
import { OwnerEventForm } from "@/components/owner-event-form";
import { Link } from "@/i18n/navigation";
import { isEventFontId, isLogoCorner, isLogoSize } from "@/lib/events/appearance";
import { calendarDateFromDb, formatAthensDateTime } from "@/lib/events/expiry";
import { bytesToMib } from "@/lib/owner/bytes";
import { requireOwnerPage } from "@/lib/owner/page";
import { getOwnerEvent, listOwnerCustomers } from "@/lib/owner/service";

export default async function OwnerEditEventPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const actor = await requireOwnerPage(locale);
  const event = await getOwnerEvent(actor, id);

  if (!event) {
    notFound();
  }

  const t = await getTranslations("owner");
  const customers = await listOwnerCustomers(actor);

  return (
    <main className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{t("editTitle")}</h1>
          <p className="mt-3 text-sm text-foreground/80">
            {event.customer.accessExpiresAt
              ? `${t("accessExpires")} ${formatAthensDateTime(event.customer.accessExpiresAt, locale)}`
              : t("accessNone")}
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <Link
            href={`/events/${event.id}/gallery`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("gallery")}
          </Link>
          <Link
            href={`/events/${event.id}`}
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("details")}
          </Link>
        </div>
      </div>
      <div className="mt-8 max-w-xl">
        <OwnerEventForm
          eventId={event.id}
          customers={customers.map((customer) => ({
            id: customer.id,
            label: customer.disabled
              ? `${customer.name} · ${customer.email} · ${t("disabled")}`
              : `${customer.name} · ${customer.email}`,
          }))}
          defaults={{
            customerId: event.customerId,
            name: event.name,
            eventDate: calendarDateFromDb(event.eventDate),
            welcomeMessageEl: event.welcomeMessageEl,
            welcomeMessageEn: event.welcomeMessageEn,
            uploadInstructionsEl: event.uploadInstructionsEl,
            uploadInstructionsEn: event.uploadInstructionsEn,
            backgroundColor: event.backgroundColor,
            accentColor: event.accentColor,
            titleFont: isEventFontId(event.titleFont) ? event.titleFont : "noto-sans",
            guestFont: isEventFontId(event.guestFont) ? event.guestFont : "noto-sans",
            logoSize: isLogoSize(event.logoSize) ? event.logoSize : "medium",
            logoCorner: isLogoCorner(event.logoCorner) ? event.logoCorner : "square",
            privacyMode: event.privacyMode === "OWN_UPLOADS" ? "OWN_UPLOADS" : "FULL_GALLERY",
            status: event.status === "DISABLED" ? "DISABLED" : "ACTIVE",
            quotaMib: bytesToMib(event.maxStorageBytes),
          }}
        />
      </div>
      <div className="mt-8">
        <OwnerDeleteButton
          eventId={event.id}
          label={t("delete")}
          confirm={t("deleteConfirm")}
        />
      </div>
    </main>
  );
}
