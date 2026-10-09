"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  updateOwnerSettingsAction,
  type OwnerFormState,
} from "@/lib/owner/actions";

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

export function OwnerSettingsForm({
  defaultRetentionDays,
  defaultQuotaMib,
  maxPhotoMib,
  maxVideoMib,
  maxEventsPerCustomer,
}: {
  defaultRetentionDays: number;
  defaultQuotaMib: number;
  maxPhotoMib: number;
  maxVideoMib: number;
  maxEventsPerCustomer: number;
}) {
  const t = useTranslations("owner");
  const [state, formAction, pending] = useActionState(updateOwnerSettingsAction, null);

  return (
    <form action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("defaultRetention")}
        <input
          className={fieldClassName}
          name="defaultRetentionDays"
          type="number"
          required
          min={0}
          max={3650}
          step={1}
          defaultValue={defaultRetentionDays}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("defaultQuota")}
        <input
          className={fieldClassName}
          name="defaultQuotaMib"
          type="number"
          required
          min={1}
          max={10485760}
          step={1}
          defaultValue={defaultQuotaMib}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("maxPhoto")}
        <input
          className={fieldClassName}
          name="maxPhotoMib"
          type="number"
          required
          min={1}
          max={2048}
          step={1}
          defaultValue={maxPhotoMib}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("maxVideo")}
        <input
          className={fieldClassName}
          name="maxVideoMib"
          type="number"
          required
          min={1}
          max={10240}
          step={1}
          defaultValue={maxVideoMib}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("maxEvents")}
        <input
          className={fieldClassName}
          name="maxEventsPerCustomer"
          type="number"
          required
          min={1}
          max={1000}
          step={1}
          defaultValue={maxEventsPerCustomer}
        />
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("pending") : t("save")}
      </Button>
    </form>
  );
}
