import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { LoginForm } from "@/components/identity-forms";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getRequestSession } from "@/lib/session";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ reset?: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const session = await getRequestSession();

  if (session) {
    redirect({ href: "/account", locale });
  }

  const { reset } = await searchParams;
  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("loginTitle")}>
      {reset === "1" ? (
        <p role="status" className="mb-6 text-sm leading-6 text-foreground/80">
          {t("loginResetNotice")}
        </p>
      ) : null}
      <LoginForm />
    </AuthCard>
  );
}
