import {
  CircleUser,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserPlus,
} from "lucide-react";
import { logoutAction } from "@/lib/identity-actions";
import { buttonVariants } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Link } from "@/i18n/navigation";
import { getRequestSession } from "@/lib/session";
import { cn } from "@/lib/utils";
import { getTranslations } from "next-intl/server";

const headerActionClass = "size-8 px-0 md:w-auto md:px-3";

function HeaderActionLabel({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <>
      <span className="md:hidden" aria-hidden="true">
        {icon}
      </span>
      <span className="sr-only md:not-sr-only">{label}</span>
    </>
  );
}

export async function SiteHeader() {
  const t = await getTranslations("auth");
  const events = await getTranslations("events");
  const owner = await getTranslations("owner");
  const session = await getRequestSession();

  return (
    <header className="mx-auto flex w-full max-w-3xl flex-nowrap items-center justify-between gap-1 px-2 py-3 md:gap-3 md:px-6 md:py-8 print:hidden">
      <Link
        href="/"
        className="min-w-0 shrink truncate text-sm font-semibold tracking-tight"
      >
        GuestMoments
      </Link>
      <div className="flex shrink-0 flex-nowrap items-center gap-0.5 min-[360px]:gap-1 md:gap-2">
        {session ? (
          <>
            {session.user.role === "OWNER" ? (
              <Link
                href="/owner"
                title={owner("nav")}
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  headerActionClass,
                )}
              >
                <HeaderActionLabel
                  label={owner("nav")}
                  icon={<LayoutDashboard className="size-4" />}
                />
              </Link>
            ) : null}
            <Link
              href="/events"
              title={events("nav")}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "h-8 w-auto px-2 md:px-3",
              )}
            >
              {events("nav")}
            </Link>
            <Link
              href="/account"
              title={t("account")}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                headerActionClass,
              )}
            >
              <HeaderActionLabel
                label={t("account")}
                icon={<CircleUser className="size-4" />}
              />
            </Link>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                title={t("logout")}
                className={headerActionClass}
              >
                <HeaderActionLabel
                  label={t("logout")}
                  icon={<LogOut className="size-4" />}
                />
              </Button>
            </form>
          </>
        ) : (
          <>
            <Link
              href="/login"
              title={t("login")}
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                headerActionClass,
              )}
            >
              <HeaderActionLabel
                label={t("login")}
                icon={<LogIn className="size-4" />}
              />
            </Link>
            <Link
              href="/register"
              title={t("register")}
              className={cn(buttonVariants({ size: "sm" }), headerActionClass)}
            >
              <HeaderActionLabel
                label={t("register")}
                icon={<UserPlus className="size-4" />}
              />
            </Link>
          </>
        )}
        <LanguageSwitcher />
      </div>
    </header>
  );
}
