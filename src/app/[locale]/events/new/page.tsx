import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { EventForm } from "@/components/event-form";
import { ServiceAccessNotice } from "@/components/service-access-notice";
import { customerNotice } from "@/lib/access";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { customerEventAllowance } from "@/lib/events/service";
import { getRequestSession } from "@/lib/session";

export default async function NewEventPage({
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
  const allowance = await customerEventAllowance(session.user);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 pb-16">
      <section className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
        <h1 className="text-3xl font-semibold tracking-tight">{t("createTitle")}</h1>
        <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">
          {t("createLead")}
        </p>
        {customerNotice(session.user, new Date()) ? (
          <div className="mt-8">
            <ServiceAccessNotice user={session.user} />
          </div>
        ) : (
          <div className="mt-8 max-w-xl">
            {allowance.atLimit ? (
              <p role="status" className="mb-4 text-sm leading-6 text-foreground/80">
                {t("eventLimit")}
              </p>
            ) : null}
            <EventForm />
          </div>
        )}
      </section>
    </main>
  );
}
