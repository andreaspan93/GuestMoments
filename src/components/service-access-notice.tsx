import { getTranslations } from "next-intl/server";
import { ResendVerificationForm } from "@/components/identity-forms";
import { customerNotice, type AccessUser } from "@/lib/access";

export async function ServiceAccessNotice({ user }: { user: AccessUser }) {
  const notice = customerNotice(user, new Date());

  if (!notice) {
    return null;
  }

  const t = await getTranslations("access");

  return (
    <section className="rounded-3xl border border-border bg-card px-6 py-6" role="status">
      <p className="text-sm leading-6 text-foreground/80">{t(notice)}</p>
      {notice === "unverified" ? <ResendVerificationForm /> : null}
    </section>
  );
}
