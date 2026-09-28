import { getTranslations } from "next-intl/server";

export default async function ForbiddenPage() {
  const t = await getTranslations("owner");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">403</h1>
      <p role="alert" className="mt-4 text-foreground/80">
        {t("forbidden")}
      </p>
    </main>
  );
}
