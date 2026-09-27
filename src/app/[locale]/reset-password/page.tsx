import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/identity-forms";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ResetPasswordPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const query = await searchParams;
  const token = firstParam(query.token);
  const error = firstParam(query.error);
  const t = await getTranslations("auth");
  const invalid = !token || error === "INVALID_TOKEN";

  return (
    <AuthCard title={t("resetTitle")} lead={t("resetLead")}>
      {invalid || !token ? (
        <div className="grid gap-4">
          <p role="alert" className="text-sm text-primary">
            {t("errors.resetInvalid")}
          </p>
          <Link
            href="/forgot-password"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            {t("forgotLink")}
          </Link>
        </div>
      ) : (
        <ResetPasswordForm token={token} />
      )}
    </AuthCard>
  );
}
