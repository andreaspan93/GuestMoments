import { getLocale, getTranslations } from "next-intl/server";
import { OwnerEventForm } from "@/components/owner-event-form";
import { requireOwnerPage } from "@/lib/owner/page";
import { listOwnerCustomers } from "@/lib/owner/service";

export default async function NewOwnerEventPage() {
  const actor = await requireOwnerPage(await getLocale());
  const t = await getTranslations("owner");
  const customers = await listOwnerCustomers(actor);

  return (
    <main className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("createTitle")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">{t("createLead")}</p>
      {customers.length === 0 ? (
        <p className="mt-8 text-sm text-foreground/80">{t("noCustomers")}</p>
      ) : (
        <div className="mt-8 max-w-xl">
          <OwnerEventForm
            customers={customers.map((customer) => ({
              id: customer.id,
              label: customer.disabled
                ? `${customer.name} · ${customer.email} · ${t("disabled")}`
                : `${customer.name} · ${customer.email}`,
            }))}
            defaults={{
              customerId: "",
              name: "",
              eventDate: "",
              welcomeMessageEl: "",
              welcomeMessageEn: "",
              uploadInstructionsEl: "",
              uploadInstructionsEn: "",
              backgroundColor: "#f7f1ea",
              accentColor: "#8c3d32",
              privacyMode: "FULL_GALLERY",
              status: "ACTIVE",
            }}
          />
        </div>
      )}
    </main>
  );
}
