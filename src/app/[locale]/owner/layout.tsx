import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { OwnerNav } from "@/components/owner-nav";
import { routing } from "@/i18n/routing";
import { requireOwnerPage } from "@/lib/owner/page";

export default async function OwnerLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  await requireOwnerPage(locale);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 pb-16">
      <OwnerNav />
      {children}
    </div>
  );
}
