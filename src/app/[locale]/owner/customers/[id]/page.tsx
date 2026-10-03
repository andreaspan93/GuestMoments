import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { OwnerAccessButton } from "@/components/owner-access-button";
import { OwnerCustomerAccessForm } from "@/components/owner-customer-access-form";
import { OwnerCustomerDeleteForm } from "@/components/owner-customer-delete-form";
import { Link } from "@/i18n/navigation";
import { formatAthensDateTime } from "@/lib/events/expiry";
import { OwnerError } from "@/lib/owner/schema";
import { requireOwnerPage } from "@/lib/owner/page";
import { getOwnerCustomer } from "@/lib/owner/service";

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

export default async function OwnerCustomerPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const locale = await getLocale();
  const actor = await requireOwnerPage(locale);
  const t = await getTranslations("owner");
  let customer;

  try {
    customer = await getOwnerCustomer(actor, id);
  } catch (error) {
    if (error instanceof OwnerError && error.code === "notFound") {
      notFound();
    }

    throw error;
  }

  return (
    <main className="flex flex-col gap-6">
      <p>
        <Link href="/owner/customers" className="text-sm text-primary underline-offset-4 hover:underline">
          {t("customers")}
        </Link>
      </p>
      <section className="rounded-3xl border border-border bg-card px-6 py-8">
        <h1 className="text-3xl font-semibold tracking-tight">{customer.name}</h1>
        <p className="mt-2 text-sm text-foreground/80">{customer.email}</p>
        <p className="mt-2 text-sm text-foreground/80">
          {customer.emailVerified ? t("emailVerified") : t("emailUnverified")}
          {" · "}
          {accessLabel(customer.accessStatus, t)}
        </p>
        <p className="mt-1 text-sm text-foreground/80">
          {customer.accessExpiresAt
            ? `${t("accessExpires")} ${formatAthensDateTime(customer.accessExpiresAt, locale)}`
            : t("accessNone")}
        </p>
        <p className="mt-1 text-sm text-foreground/80">
          {t("created")} {formatAthensDateTime(customer.createdAt, locale)}
          {" · "}
          {t("eventsCount", { count: customer._count.events })}
        </p>
        <div className="mt-4">
          <OwnerAccessButton
            userId={customer.id}
            disabled={customer.disabled}
            disableLabel={t("disable")}
            enableLabel={t("enable")}
            confirm={t("disableConfirm")}
          />
        </div>
        <OwnerCustomerAccessForm userId={customer.id} />
      </section>
      <OwnerCustomerDeleteForm userId={customer.id} email={customer.email} />
    </main>
  );
}
