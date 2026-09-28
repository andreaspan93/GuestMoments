import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { CustomerGallery } from "@/components/customer-gallery";
import { Link, redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { listCustomerGallery } from "@/lib/gallery/service";
import { getCustomerEvent } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";

export default async function EventGalleryPage({
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
  const closed = event.status === "EXPIRED" || event.expiresAt.getTime() <= new Date().getTime();
  const items = closed ? [] : await listCustomerGallery(session.user, event.id);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-2 text-sm text-foreground/80">{t("galleryTitle")}</p>
        </div>
        <Link href={`/events/${event.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
          {t("edit")}
        </Link>
      </div>
      {closed ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-10 text-foreground/80">
          {t("galleryClosed")}
        </p>
      ) : (
        <CustomerGallery eventId={event.id} initialItems={items} />
      )}
    </main>
  );
}
