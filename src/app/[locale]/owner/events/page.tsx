import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { guestEventUrl } from "@/lib/events/code";
import { calendarDateFromDb, formatAthensDateTime, formatCalendarDate } from "@/lib/events/expiry";
import { requireOwnerPage } from "@/lib/owner/page";
import { listOwnerEvents } from "@/lib/owner/service";

export default async function OwnerEventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const actor = await requireOwnerPage(locale);
  const t = await getTranslations("owner");
  const eventsT = await getTranslations("events");
  const events = await listOwnerEvents(actor);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("events")}</h1>
        <Link href="/owner/events/new" className={buttonVariants()}>
          {eventsT("create")}
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-10 text-foreground/80">
          {t("emptyEvents")}
        </p>
      ) : (
        <ul className="grid gap-4">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-3xl border border-border bg-card px-6 py-6 shadow-sm"
            >
              <h2 className="text-xl font-semibold">{event.name}</h2>
              <p className="mt-2 text-sm text-foreground/80">
                {event.customer.name}
                {" · "}
                {event.customer.email}
              </p>
              <p className="mt-1 text-sm text-foreground/80">
                {formatCalendarDate(calendarDateFromDb(event.eventDate), locale)}
                {" · "}
                {event.status === "ACTIVE" ? eventsT("active") : eventsT("disabled")}
                {" · "}
                {t("retentionValue", { days: event.retentionDays })}
              </p>
              <p className="mt-1 text-sm text-foreground/80">
                {eventsT("expires")} {formatAthensDateTime(event.expiresAt, locale)}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/events/${event.id}/gallery`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("gallery")}
                </Link>
                <Link
                  href={`/owner/events/${event.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {eventsT("edit")}
                </Link>
                <Link
                  href={`/events/${event.id}/qr`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("qr")}
                </Link>
                <a
                  href={guestEventUrl(event.uniqueCode)}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("guest")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
