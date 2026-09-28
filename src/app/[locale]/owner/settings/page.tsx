import { getLocale, getTranslations } from "next-intl/server";
import { OwnerSettingsForm } from "@/components/owner-settings-form";
import { bytesToMib } from "@/lib/owner/bytes";
import { requireOwnerPage } from "@/lib/owner/page";
import { getOwnerSettings } from "@/lib/owner/service";

export default async function OwnerSettingsPage() {
  const actor = await requireOwnerPage(await getLocale());
  const t = await getTranslations("owner");
  const settings = await getOwnerSettings(actor);

  return (
    <main className="rounded-3xl border border-border bg-card px-6 py-10 shadow-sm sm:px-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t("settings")}</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-foreground/80">{t("settingsLead")}</p>
      <div className="mt-8 max-w-xl">
        <OwnerSettingsForm
          defaultRetentionDays={settings.defaultRetentionDays}
          defaultQuotaMib={bytesToMib(settings.defaultMaxStorageBytes)}
          maxPhotoMib={bytesToMib(settings.maxPhotoBytes)}
          maxVideoMib={bytesToMib(settings.maxVideoBytes)}
        />
      </div>
    </main>
  );
}
