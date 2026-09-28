import { getLocale, getTranslations } from "next-intl/server";
import { requireOwnerPage } from "@/lib/owner/page";
import { platformCounts } from "@/lib/owner/service";

export default async function OwnerHomePage() {
  const actor = await requireOwnerPage(await getLocale());
  const t = await getTranslations("owner");
  const counts = await platformCounts(actor);

  return (
    <main className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-3 text-sm leading-6 text-foreground/80">{t("lead")}</p>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card px-6 py-6">
          <dt className="text-sm text-foreground/70">{t("customerCount")}</dt>
          <dd className="mt-2 text-3xl font-semibold">{counts.customers}</dd>
        </div>
        <div className="rounded-3xl border border-border bg-card px-6 py-6">
          <dt className="text-sm text-foreground/70">{t("eventCount")}</dt>
          <dd className="mt-2 text-3xl font-semibold">{counts.events}</dd>
        </div>
        <div className="rounded-3xl border border-border bg-card px-6 py-6">
          <dt className="text-sm text-foreground/70">{t("mediaCount")}</dt>
          <dd className="mt-2 text-3xl font-semibold">{counts.media}</dd>
        </div>
        <div className="rounded-3xl border border-border bg-card px-6 py-6">
          <dt className="text-sm text-foreground/70">{t("storageCount")}</dt>
          <dd className="mt-2 text-3xl font-semibold">{counts.storageLabel}</dd>
        </div>
      </dl>
    </main>
  );
}
