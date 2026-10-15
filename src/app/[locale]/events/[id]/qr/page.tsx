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

  return (
    <>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 pb-16 sm:px-6 print:hidden">
        <ServiceAccessNotice user={session.user} />
        <section className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-10 text-center shadow-sm sm:px-12">
          <EventLogo
            src={logoUrl}
            className="mb-6 h-24 w-auto max-w-full object-contain sm:h-32"
          />
          <h1 className="text-3xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">{t("qrLead")}</p>
          {/* Generated locally; the image optimizer is not used. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrSrc}
            alt={t("qrAlt")}
            width={512}
            height={512}
            className="mt-8 h-auto w-full max-w-sm"
          />
          <p className="mt-4 max-w-md break-all font-mono text-sm">{url}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
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
      <section className="hidden print:flex print:min-h-[100vh] print:flex-col print:items-center print:bg-white print:px-8 print:pt-4 print:text-center print:text-black">
        <h1 className="text-4xl font-semibold tracking-tight">{event.name}</h1>
        <EventLogo
          src={logoUrl}
          className="mt-6 h-28 w-auto max-w-[70mm] object-contain"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt=""
          width={512}
          height={512}
          className="mt-8 h-auto w-[90mm] max-w-full"
        />
      </section>
    </>
  );
}
