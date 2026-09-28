import { logoutAction } from "@/lib/identity-actions";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { getRequestSession } from "@/lib/session";
import { getTranslations } from "next-intl/server";

export async function SiteHeader() {
  const t = await getTranslations("auth");
  const events = await getTranslations("events");
  const owner = await getTranslations("owner");
  const session = await getRequestSession();

  return (
    <header className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-3 px-6 py-8 print:hidden">
      <Link href="/" className="text-sm font-semibold tracking-tight">
        GuestMoments
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {session ? (
          <>
            {session.user.role === "OWNER" ? (
              <Link
                href="/owner"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                {owner("nav")}
              </Link>
            ) : null}
            <Link
              href="/events"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {events("nav")}
            </Link>
            <Link
              href="/account"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("account")}
            </Link>
            <form action={logoutAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("logout")}
              </Button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              {t("login")}
            </Link>
            <Link
              href="/register"
              className={buttonVariants({ size: "sm" })}
            >
              {t("register")}
            </Link>
          </>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
