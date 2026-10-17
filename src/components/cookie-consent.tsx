"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { saveConsentAction } from "@/lib/consent-actions";
import { COOKIE_SETTINGS_EVENT, type ConsentChoice } from "@/lib/consent";
import type { PrivacyCopy } from "@/content/privacy-copy";

export function CookieConsent({
  copy,
  choice,
}: {
  copy: PrivacyCopy["consent"];
  choice: ConsentChoice | null;
}) {
  const router = useRouter();
  const titleId = useId();
  const bodyId = useId();
  const [open, setOpen] = useState(choice === null);
  const [manage, setManage] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const openSettings = () => {
      setManage(true);
      setOpen(true);
    };

    window.addEventListener(COOKIE_SETTINGS_EVENT, openSettings);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, openSettings);
  }, [choice]);

  if (!open) {
    return null;
  }

  async function save() {
    setPending(true);
    await saveConsentAction(false);
    setOpen(false);
    setManage(false);
    router.refresh();
    setPending(false);
  }

  return (
    <div className="cookie-banner pointer-events-none fixed inset-x-0 bottom-0 z-40 p-3 print:hidden sm:p-4">
      <section
        role="dialog"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        aria-modal="false"
        className="pointer-events-auto mx-auto grid w-full max-w-3xl gap-4 rounded-3xl border border-border bg-card p-4 text-foreground shadow-lg sm:p-5"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-base font-semibold">
            {copy.title}
          </h2>
          {choice ? (
            <button
              type="button"
              className="text-sm underline underline-offset-4"
              onClick={() => setOpen(false)}
            >
              {copy.close}
            </button>
          ) : null}
        </div>
        <p id={bodyId} className="text-sm leading-6 text-foreground/80">
          {copy.body}
        </p>
        {manage ? (
          <fieldset className="grid gap-3 text-sm">
            <label className="grid gap-1 rounded-2xl bg-muted px-3 py-3">
              <span className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked disabled />
                {copy.necessary}
              </span>
              <span className="leading-6 text-foreground/80">{copy.necessaryHelp}</span>
            </label>
            <p className="rounded-2xl bg-muted px-3 py-3 leading-6">
              <span className="font-medium">{copy.preferences}. </span>
              {copy.preferencesHelp}
            </p>
            <p className="leading-6 text-foreground/80">{copy.unused}</p>
          </fieldset>
        ) : (
          <p className="text-sm leading-6 text-foreground/80">{copy.unused}</p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
            disabled={pending}
            onClick={() => save()}
          >
            {copy.accept}
          </button>
          <button
            type="button"
            className="h-10 rounded-full border border-border bg-background px-4 text-sm font-medium disabled:opacity-50"
            disabled={pending}
            onClick={() => save()}
          >
            {copy.reject}
          </button>
          {manage ? (
            <button
              type="button"
              className="h-10 rounded-full border border-border bg-background px-4 text-sm font-medium disabled:opacity-50"
              disabled={pending}
              onClick={() => save()}
            >
              {copy.save}
            </button>
          ) : (
            <button
              type="button"
              className="h-10 rounded-full border border-border bg-background px-4 text-sm font-medium"
              onClick={() => setManage(true)}
            >
              {copy.manage}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
