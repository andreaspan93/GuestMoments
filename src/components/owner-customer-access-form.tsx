"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { activateCustomerAction, type OwnerFormState } from "@/lib/owner/actions";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FormMessage({ state }: { state: OwnerFormState }) {
  const t = useTranslations("owner");

  if (state?.error) {
    return (
      <p role="alert" className="text-sm text-primary">
        {t(`errors.${state.error}`)}
      </p>
    );
  }

  if (state?.success === "saved") {
    return (
      <p role="status" className="text-sm text-foreground/80">
        {t("saved")}
      </p>
    );
  }

  return null;
}

export function OwnerCustomerAccessForm({ userId }: { userId: string }) {
  const t = useTranslations("owner");
  const [state, action, pending] = useActionState(activateCustomerAction.bind(null, userId), null);

  return (
    <form action={action} className="mt-6 grid max-w-xl gap-4">
      <p className="text-sm leading-6 text-foreground/80">{t("activateLead")}</p>
      <label className="grid gap-2 text-sm font-medium">
        {t("duration")}
        <select className={fieldClassName} name="duration" defaultValue="30">
          <option value="30">{t("days30")}</option>
          <option value="60">{t("days60")}</option>
          <option value="90">{t("days90")}</option>
          <option value="180">{t("days180")}</option>
          <option value="365">{t("days365")}</option>
          <option value="custom">{t("customDate")}</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("customDate")}
        <input className={fieldClassName} name="expiresOn" type="date" />
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("pending") : t("activate")}
      </Button>
    </form>
  );
}
