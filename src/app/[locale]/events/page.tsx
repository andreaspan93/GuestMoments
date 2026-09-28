import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { formatAthensDateTime, formatCalendarDate, calendarDateFromDb } from "@/lib/events/expiry";
import { guestEventUrl } from "@/lib/events/code";
import { mediaTotals } from "@/lib/gallery/service";
import { listCustomerEvents } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";

export default async function EventsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }

  const t = await getTranslations("events");
  const events = await listCustomerEvents(session.user);
  const totals = await mediaTotals(events.map((event) => event.id));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <Link href="/events/new" className={buttonVariants()}>
          {t("create")}
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-10 text-foreground/80">
          {t("empty")}
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
                {formatCalendarDate(calendarDateFromDb(event.eventDate), locale)}
                {" · "}
                {event.status === "ACTIVE" ? t("active") : t("disabled")}
                {" · "}
                {event.privacyMode === "FULL_GALLERY"
                  ? t("fullGallery")
                  : t("ownUploads")}
              </p>
              <p className="mt-1 text-sm text-foreground/80">
                {t("expires")} {formatAthensDateTime(event.expiresAt, locale)}
              </p>
              <p className="mt-1 text-sm text-foreground/80">
                {t("counts", {
                  photos: totals.get(event.id)?.photos ?? 0,
                  videos: totals.get(event.id)?.videos ?? 0,
                  storage: totals.get(event.id)?.storageLabel ?? "0 MB",
                })}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/events/${event.id}/gallery`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("gallery")}
                </Link>
                <Link
                  href={`/events/${event.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("edit")}
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
                  {t("openGuest")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
