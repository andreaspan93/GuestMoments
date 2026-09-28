"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  createOwnerEventAction,
  updateOwnerEventAction,
  type OwnerFormState,
} from "@/lib/owner/actions";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const areaClassName =
  "min-h-28 rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type OwnerEventDefaults = {
  customerId: string;
  name: string;
  eventDate: string;
  welcomeMessageEl: string;
  welcomeMessageEn: string;
  uploadInstructionsEl: string;
  uploadInstructionsEn: string;
  backgroundColor: string;
  accentColor: string;
  privacyMode: "OWN_UPLOADS" | "FULL_GALLERY";
  status: "ACTIVE" | "DISABLED";
  retentionDays?: number;
  quotaMib?: number;
};

export type OwnerCustomerOption = {
  id: string;
  label: string;
};

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

export function OwnerEventForm({
  eventId,
  customers,
  defaults,
}: {
  eventId?: string;
  customers: OwnerCustomerOption[];
  defaults: OwnerEventDefaults;
}) {
  const t = useTranslations("owner");
  const events = useTranslations("events");
  const action = eventId
    ? updateOwnerEventAction.bind(null, eventId)
    : createOwnerEventAction;
  const [state, formAction, pending] = useActionState(action, null);
  const [privacyMode, setPrivacyMode] = useState(defaults.privacyMode);
  const [status, setStatus] = useState(defaults.status);
  const [savedPrivacy, setSavedPrivacy] = useState(defaults.privacyMode);
  const [savedStatus, setSavedStatus] = useState(defaults.status);
  const formRef = useRef<HTMLFormElement>(null);

  if (defaults.privacyMode !== savedPrivacy || defaults.status !== savedStatus) {
    setSavedPrivacy(defaults.privacyMode);
    setSavedStatus(defaults.status);
    setPrivacyMode(defaults.privacyMode);
    setStatus(defaults.status);
  }

  useEffect(() => {
    if (state?.success !== "saved") {
      return;
    }

    const form = formRef.current;

    if (!form) {
      return;
    }

    const apply = () => {
      const privacy = form.elements.namedItem("privacyMode");
      const statusField = form.elements.namedItem("status");

      if (privacy instanceof HTMLSelectElement) {
        privacy.value = privacyMode;
      }

      if (statusField instanceof HTMLSelectElement) {
        statusField.value = status;
      }
    };

    apply();
    const frame = requestAnimationFrame(apply);

    return () => cancelAnimationFrame(frame);
  }, [state, privacyMode, status]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("customer")}
        <select
          className={fieldClassName}
          name="customerId"
          required
          defaultValue={defaults.customerId}
        >
          <option value="">{t("customer")}</option>
          {customers.map((customer) => (
            <option key={customer.id} value={customer.id}>
              {customer.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("name")}
        <input
          className={fieldClassName}
          name="name"
          required
          maxLength={120}
          defaultValue={defaults.name}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("date")}
        <input
          className={fieldClassName}
          name="eventDate"
          type="date"
          required
          defaultValue={defaults.eventDate}
        />
      </label>
      {eventId ? (
        <>
          <label className="grid gap-2 text-sm font-medium">
            {t("retention")}
            <input
              className={fieldClassName}
              name="retentionDays"
              type="number"
              required
              min={0}
              max={3650}
              step={1}
              defaultValue={defaults.retentionDays ?? 0}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t("quota")}
            <input
              className={fieldClassName}
              name="quotaMib"
              type="number"
              required
              min={1}
              max={10485760}
              step={1}
              defaultValue={defaults.quotaMib ?? 1}
            />
          </label>
          <p className="text-sm leading-6 text-foreground/80">{t("retentionHint")}</p>
        </>
      ) : null}
      <label className="grid gap-2 text-sm font-medium">
        {events("welcomeEl")}
        <textarea
          className={areaClassName}
          name="welcomeMessageEl"
          maxLength={4000}
          defaultValue={defaults.welcomeMessageEl}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("welcomeEn")}
        <textarea
          className={areaClassName}
          name="welcomeMessageEn"
          maxLength={4000}
          defaultValue={defaults.welcomeMessageEn}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("instructionsEl")}
        <textarea
          className={areaClassName}
          name="uploadInstructionsEl"
          maxLength={4000}
          defaultValue={defaults.uploadInstructionsEl}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("instructionsEn")}
        <textarea
          className={areaClassName}
          name="uploadInstructionsEn"
          maxLength={4000}
          defaultValue={defaults.uploadInstructionsEn}
        />
      </label>
      <p className="text-sm leading-6 text-foreground/80">{events("fallbackHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          {events("background")}
          <input
            className="h-10 w-full rounded-full border border-border bg-background px-2"
            name="backgroundColor"
            type="color"
            defaultValue={defaults.backgroundColor}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {events("accent")}
          <input
            className="h-10 w-full rounded-full border border-border bg-background px-2"
            name="accentColor"
            type="color"
            defaultValue={defaults.accentColor}
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        {events("privacy")}
        <select
          className={fieldClassName}
          name="privacyMode"
          value={privacyMode}
          onChange={(event) => {
            setPrivacyMode(
              event.target.value === "OWN_UPLOADS" ? "OWN_UPLOADS" : "FULL_GALLERY",
            );
          }}
        >
          <option value="FULL_GALLERY">{events("fullGallery")}</option>
          <option value="OWN_UPLOADS">{events("ownUploads")}</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {events("status")}
        <select
          className={fieldClassName}
          name="status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value === "DISABLED" ? "DISABLED" : "ACTIVE");
          }}
        >
          <option value="ACTIVE">{events("active")}</option>
          <option value="DISABLED">{events("disabled")}</option>
        </select>
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("pending") : eventId ? t("save") : t("createSubmit")}
      </Button>
    </form>
  );
}
