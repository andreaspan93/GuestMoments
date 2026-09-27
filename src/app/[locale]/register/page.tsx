import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { RegisterForm } from "@/components/identity-forms";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getRequestSession } from "@/lib/session";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
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

  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("registerTitle")} lead={t("registerLead")}>
      <RegisterForm />
    </AuthCard>
  );
}
