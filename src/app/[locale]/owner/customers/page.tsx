import { getLocale, getTranslations } from "next-intl/server";
import { OwnerAccessButton } from "@/components/owner-access-button";
import { requireOwnerPage } from "@/lib/owner/page";
import { listOwnerCustomers } from "@/lib/owner/service";

export default async function OwnerCustomersPage() {
  const actor = await requireOwnerPage(await getLocale());
  const t = await getTranslations("owner");
  const customers = await listOwnerCustomers(actor);

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("customers")}</h1>
      {customers.length === 0 ? (
        <p className="rounded-3xl border border-border bg-card px-6 py-10 text-foreground/80">
          {t("emptyCustomers")}
        </p>
      ) : (
        <ul className="grid gap-4">
          {customers.map((customer) => (
            <li
              key={customer.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-card px-6 py-6"
            >
              <div>
                <h2 className="text-lg font-semibold">{customer.name}</h2>
                <p className="mt-1 text-sm text-foreground/80">{customer.email}</p>
                <p className="mt-1 text-sm text-foreground/80">
                  {customer.disabled ? t("disabled") : t("enabled")}
                  {" · "}
                  {t("eventsCount", { count: customer._count.events })}
                </p>
              </div>
              <OwnerAccessButton
                userId={customer.id}
                disabled={customer.disabled}
                disableLabel={t("disable")}
                enableLabel={t("enable")}
                confirm={t("disableConfirm")}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
