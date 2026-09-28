import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export async function OwnerNav() {
  const t = await getTranslations("owner");

  return (
    <nav className="flex flex-wrap gap-2" aria-label={t("nav")}>
      <Link href="/owner" className={buttonVariants({ variant: "outline", size: "sm" })}>
        {t("overview")}
      </Link>
      <Link
        href="/owner/customers"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t("customers")}
      </Link>
      <Link
        href="/owner/events"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t("events")}
      </Link>
      <Link
        href="/owner/settings"
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        {t("settings")}
      </Link>
    </nav>
  );
}
