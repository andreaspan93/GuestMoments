"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  createEventAction,
  updateEventAction,
  type EventFormState,
} from "@/lib/events/actions";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const areaClassName =
  "min-h-28 rounded-2xl border border-border bg-background px-4 py-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type EventFormDefaults = {
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
};

const emptyEvent: EventFormDefaults = {
  name: "",
  eventDate: "",
  welcomeMessageEl: "",
  welcomeMessageEn: "",
  uploadInstructionsEl: "",
  uploadInstructionsEn: "",
  backgroundColor: "#f7f1ea",
  accentColor: "#8c3d32",
  privacyMode: "FULL_GALLERY",
  status: "ACTIVE",
};

function FormMessage({ state }: { state: EventFormState }) {
  const t = useTranslations("events");

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

export function EventForm({
  eventId,
  defaults,
}: {
  eventId?: string;
  defaults?: EventFormDefaults;
}) {
  const t = useTranslations("events");
  const values = defaults ?? emptyEvent;
  const action = eventId
    ? updateEventAction.bind(null, eventId)
    : createEventAction;
  const [state, formAction, pending] = useActionState(action, null);
  const [privacyMode, setPrivacyMode] = useState(values.privacyMode);
  const [status, setStatus] = useState(values.status);
  const [savedPrivacy, setSavedPrivacy] = useState(values.privacyMode);
  const [savedStatus, setSavedStatus] = useState(values.status);
  const formRef = useRef<HTMLFormElement>(null);

  if (values.privacyMode !== savedPrivacy || values.status !== savedStatus) {
    setSavedPrivacy(values.privacyMode);
    setSavedStatus(values.status);
    setPrivacyMode(values.privacyMode);
    setStatus(values.status);
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
        {t("name")}
        <input
          className={fieldClassName}
          name="name"
          required
          maxLength={120}
          defaultValue={values.name}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("date")}
        <input
          className={fieldClassName}
          name="eventDate"
          type="date"
          required
          defaultValue={values.eventDate}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("welcomeEl")}
        <textarea
          className={areaClassName}
          name="welcomeMessageEl"
          maxLength={4000}
          defaultValue={values.welcomeMessageEl}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("welcomeEn")}
        <textarea
          className={areaClassName}
          name="welcomeMessageEn"
          maxLength={4000}
          defaultValue={values.welcomeMessageEn}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("instructionsEl")}
        <textarea
          className={areaClassName}
          name="uploadInstructionsEl"
          maxLength={4000}
          defaultValue={values.uploadInstructionsEl}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("instructionsEn")}
        <textarea
          className={areaClassName}
          name="uploadInstructionsEn"
          maxLength={4000}
          defaultValue={values.uploadInstructionsEn}
        />
      </label>
      <p className="text-sm leading-6 text-foreground/80">{t("fallbackHint")}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          {t("background")}
          <input
            className="h-10 w-full rounded-full border border-border bg-background px-2"
            name="backgroundColor"
            type="color"
            defaultValue={values.backgroundColor}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("accent")}
          <input
            className="h-10 w-full rounded-full border border-border bg-background px-2"
            name="accentColor"
            type="color"
            defaultValue={values.accentColor}
          />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        {t("privacy")}
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
          <option value="FULL_GALLERY">{t("fullGallery")}</option>
          <option value="OWN_UPLOADS">{t("ownUploads")}</option>
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("status")}
        <select
          className={fieldClassName}
          name="status"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value === "DISABLED" ? "DISABLED" : "ACTIVE");
          }}
        >
          <option value="ACTIVE">{t("active")}</option>
          <option value="DISABLED">{t("disabled")}</option>
        </select>
      </label>
      <FormMessage state={state} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? t("pending") : eventId ? t("save") : t("createSubmit")}
      </Button>
    </form>
  );
}
