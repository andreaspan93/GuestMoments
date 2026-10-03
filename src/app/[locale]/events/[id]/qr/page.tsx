import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { buttonVariants } from "@/components/ui/button";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { guestEventUrl } from "@/lib/events/code";
import { getCustomerEvent } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-16">
      <ServiceAccessNotice user={session.user} />
      <section className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
        <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">{t("qrLead")}</p>
        {/* Generated locally; the image optimizer is not used. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/events/${event.id}/qr`}
          alt={t("qrAlt")}
          width={512}
          height={512}
          className="mt-8 h-auto w-full max-w-xs"
        />
        <p className="mt-4 break-all font-mono text-sm">{url}</p>
        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <a
            href={`/api/events/${event.id}/qr?download=1`}
            className={buttonVariants({ variant: "outline" })}
          >
            {t("downloadQr")}
          </a>
          <PrintButton label={t("print")} />
        </div>
      </section>
    </main>
  );
}
