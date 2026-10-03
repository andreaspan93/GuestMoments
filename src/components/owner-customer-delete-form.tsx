"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { deleteCustomerAction, type OwnerFormState } from "@/lib/owner/actions";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FormMessage({ state }: { state: OwnerFormState }) {
  const t = useTranslations("owner");

  if (!state?.error) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-primary">
      {t(`errors.${state.error}`)}
    </p>
  );
}

export function OwnerCustomerDeleteForm({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  const t = useTranslations("owner");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [state, action, pending] = useActionState(deleteCustomerAction.bind(null, userId), null);
  const matches = confirmEmail.trim().toLowerCase() === email.trim().toLowerCase();

  return (
    <section className="rounded-3xl border border-primary/40 bg-card px-6 py-8">
      <h2 className="text-xl font-semibold tracking-tight">{t("deleteCustomer")}</h2>
      <p className="mt-2 text-sm leading-6 text-foreground/80">{t("deleteCustomerLead")}</p>
      <ul className="mt-4 list-disc space-y-1 pl-5 text-sm leading-6 text-foreground/80">
        <li>{t("deleteCustomerAccount")}</li>
        <li>{t("deleteCustomerEvents")}</li>
        <li>{t("deleteCustomerMedia")}</li>
        <li>{t("deleteCustomerAlbums")}</li>
        <li>{t("deleteCustomerUploads")}</li>
        <li>{t("deleteCustomerAuth")}</li>
      </ul>
      <form action={action} className="mt-6 grid max-w-xl gap-4">
        <label className="grid gap-2 text-sm font-medium">
          {t("deleteCustomerConfirmLabel")}
          <input
            className={fieldClassName}
            name="confirmEmail"
            type="email"
            autoComplete="off"
            value={confirmEmail}
            onChange={(event) => setConfirmEmail(event.target.value)}
            required
          />
        </label>
        <FormMessage state={state} />
        <Button
          type="button"
          disabled={pending || !matches}
          onClick={() => dialogRef.current?.showModal()}
        >
          {t("deleteCustomerSubmit")}
        </Button>
        <dialog
          ref={dialogRef}
          className="w-full max-w-lg rounded-3xl border border-primary/40 bg-card p-6 text-foreground"
        >
          <h3 className="text-lg font-semibold">{t("deleteCustomer")}</h3>
          <p className="mt-3 text-sm leading-6 text-foreground/80">{t("deleteCustomerConfirm")}</p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
              {t("deleteCustomerCancel")}
            </Button>
            <Button type="submit" disabled={pending || !matches} aria-busy={pending}>
              {pending ? t("pending") : t("deleteCustomerFinal")}
            </Button>
          </div>
        </dialog>
      </form>
    </section>
  );
}
