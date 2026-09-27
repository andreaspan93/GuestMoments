import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { AccountForm } from "@/components/identity-forms";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getRequestSession } from "@/lib/session";

export default async function AccountPage({
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

  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }

  const t = await getTranslations("auth");

  return (
    <AuthCard title={t("accountTitle")} lead={t("accountLead")}>
      <AccountForm name={session.user.name} email={session.user.email} />
    </AuthCard>
  );
}
