"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { setCustomerAccessAction } from "@/lib/owner/actions";

function AccessSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const t = useTranslations("owner");

  return (
    <Button type="submit" variant="outline" size="sm" disabled={pending} aria-busy={pending}>
      {pending ? t("pending") : label}
    </Button>
  );
}

export function OwnerAccessButton({
  userId,
  disabled,
  disableLabel,
  enableLabel,
  confirm,
}: {
  userId: string;
  disabled: boolean;
  disableLabel: string;
  enableLabel: string;
  confirm: string;
}) {
  return (
    <form
      action={setCustomerAccessAction.bind(null, userId, !disabled)}
      onSubmit={(event) => {
        if (!disabled && !window.confirm(confirm)) {
          event.preventDefault();
        }
      }}
    >
      <AccessSubmit label={disabled ? enableLabel : disableLabel} />
    </form>
  );
}
