import { getLocale, getTranslations } from "next-intl/server";
import { OwnerAccessButton } from "@/components/owner-access-button";
import { Link } from "@/i18n/navigation";
import { formatAthensDateTime } from "@/lib/events/expiry";
import { requireOwnerPage } from "@/lib/owner/page";
import { listOwnerCustomers } from "@/lib/owner/service";

function accessLabel(
  status: string,
  t: Awaited<ReturnType<typeof getTranslations<"owner">>>,
) {
  if (status === "ACTIVE") {
    return t("accessActive");
  }

  if (status === "EXPIRED") {
    return t("accessExpired");
  }

  if (status === "DISABLED") {
    return t("accessDisabled");
  }

  return t("accessPending");
}

export default async function OwnerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string }>;
}) {
  const locale = await getLocale();
  const actor = await requireOwnerPage(locale);
  const t = await getTranslations("owner");
  const customers = await listOwnerCustomers(actor);
  const { deleted } = await searchParams;

  return (
    <main className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t("customers")}</h1>
      {deleted === "1" ? (
        <p role="status" className="rounded-3xl border border-border bg-card px-6 py-4 text-sm text-foreground/80">
          {t("deletedCustomer")}
        </p>
      ) : null}
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
                  {customer.emailVerified ? t("emailVerified") : t("emailUnverified")}
                  {" · "}
                  {accessLabel(customer.accessStatus, t)}
                  {" · "}
                  {customer.accessExpiresAt
                    ? `${t("accessExpires")} ${formatAthensDateTime(customer.accessExpiresAt, locale)}`
                    : t("accessNone")}
                </p>
                <p className="mt-1 text-sm text-foreground/80">
                  {t("created")} {formatAthensDateTime(customer.createdAt, locale)}
                  {" · "}
                  {t("eventsCount", { count: customer._count.events })}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/owner/customers/${customer.id}`}
                  className="text-sm text-primary underline-offset-4 hover:underline"
                >
                  {t("viewCustomer")}
                </Link>
                <OwnerAccessButton
                  userId={customer.id}
                  disabled={customer.disabled}
                  disableLabel={t("disable")}
                  enableLabel={t("enable")}
                  confirm={t("disableConfirm")}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
