"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BrandingUploads } from "@/components/branding-uploads";
import { EventAppearanceFields } from "@/components/event-appearance-fields";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import {
  defaultEventAppearance,
  type EventFontId,
  type LogoCorner,
  type LogoSize,
} from "@/lib/events/appearance";
import {
  createEventAction,
  updateEventAction,
  type EventFormState,
} from "@/lib/events/actions";
import {
  pathAfterEventCreated,
  pathAfterEventUpdated,
  shouldRedirectAfterEdit,
} from "@/lib/events/create-flow";
import { uploadBrandingFile, type BrandingSlot } from "@/lib/uploads/branding-client";

const finishingIds = new Set<string>();

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
  titleFont: EventFontId;
  guestFont: EventFontId;
  logoSize: LogoSize;
  logoCorner: LogoCorner;
  privacyMode: "OWN_UPLOADS" | "FULL_GALLERY";
  guestDownloadsEnabled: boolean;
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
  ...defaultEventAppearance,
  privacyMode: "FULL_GALLERY",
  guestDownloadsEnabled: true,
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
  brandingPreviews,
}: {
  eventId?: string;
  defaults?: EventFormDefaults;
  brandingPreviews?: {
    cover: string | null;
    logo: string | null;
    background: string | null;
  };
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const values = defaults ?? emptyEvent;
  const action = eventId
    ? updateEventAction.bind(null, eventId)
    : createEventAction;
  const [state, formAction, pending] = useActionState(action, null);
  const [privacyMode, setPrivacyMode] = useState(values.privacyMode);
  const [status, setStatus] = useState(values.status);
  const [guestDownloadsEnabled, setGuestDownloadsEnabled] = useState(values.guestDownloadsEnabled);
  const [savedPrivacy, setSavedPrivacy] = useState(values.privacyMode);
  const [savedStatus, setSavedStatus] = useState(values.status);
  const [savedDownloads, setSavedDownloads] = useState(values.guestDownloadsEnabled);
  const [finishing, setFinishing] = useState(false);
  const [brandingError, setBrandingError] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const stagedFiles = useRef<Partial<Record<BrandingSlot, File>>>({});
  const redirectStarted = useRef(false);

  if (
    values.privacyMode !== savedPrivacy ||
    values.status !== savedStatus ||
    values.guestDownloadsEnabled !== savedDownloads
  ) {
    setSavedPrivacy(values.privacyMode);
    setSavedStatus(values.status);
    setSavedDownloads(values.guestDownloadsEnabled);
    setPrivacyMode(values.privacyMode);
    setStatus(values.status);
    setGuestDownloadsEnabled(values.guestDownloadsEnabled);
  }

  useEffect(() => {
    const createdId = state?.createdId;
    const savedId = state?.savedId;
    const targetId = createdId ?? savedId;

    if (!targetId || redirectStarted.current || finishingIds.has(targetId)) {
      return;
    }

    redirectStarted.current = true;
    finishingIds.add(targetId);
    const files = stagedFiles.current;
    const editing = Boolean(savedId) && !createdId;
    setFinishing(true);
    void (async () => {
      let uploadsSucceeded = true;

      for (const slot of ["cover", "logo", "background"] as const) {
        const file = files[slot];

        if (!file) {
          continue;
        }

        try {
          await uploadBrandingFile(targetId, slot, file);
        } catch {
          uploadsSucceeded = false;

          if (editing) {
            break;
          }
        }
      }

      if (editing && !shouldRedirectAfterEdit(true, uploadsSucceeded)) {
        finishingIds.delete(targetId);
        redirectStarted.current = false;
        setFinishing(false);
        setBrandingError(true);
        return;
      }

      router.push(editing ? pathAfterEventUpdated() : pathAfterEventCreated());
    })();
  }, [router, state]);

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
    <form
      ref={formRef}
      action={formAction}
      className="grid gap-4"
      onSubmit={() => setBrandingError(false)}
    >
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
            className="color-well"
            name="backgroundColor"
            type="color"
            defaultValue={values.backgroundColor}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("accent")}
          <input
            className="color-well"
            name="accentColor"
            type="color"
            defaultValue={values.accentColor}
          />
        </label>
      </div>
      <EventAppearanceFields
        titleFont={values.titleFont}
        guestFont={values.guestFont}
        logoSize={values.logoSize}
        logoCorner={values.logoCorner}
      />
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
      {privacyMode === "FULL_GALLERY" ? (
        <label className="flex items-start gap-3 text-sm leading-6 font-medium">
          <input
            className="mt-1 size-4 accent-primary"
            type="checkbox"
            name="guestDownloadsEnabled"
            value="true"
            checked={guestDownloadsEnabled}
            onChange={(event) => setGuestDownloadsEnabled(event.target.checked)}
          />
          <span>{t("guestDownloads")}</span>
        </label>
      ) : (
        <input
          type="hidden"
          name="guestDownloadsEnabled"
          value={guestDownloadsEnabled ? "true" : "false"}
        />
      )}
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
      <BrandingUploads
        eventId={eventId}
        previews={brandingPreviews}
        disabled={pending || finishing}
        uploadOnSave={Boolean(eventId)}
        onStagedChange={(files) => {
          stagedFiles.current = files;
        }}
      />
      {brandingError ? (
        <p role="alert" className="text-sm text-primary">
          {t("brandingFailed")}
        </p>
      ) : null}
      <FormMessage state={state} />
      <Button type="submit" disabled={pending || finishing} aria-busy={pending || finishing}>
        {pending || finishing ? t("pending") : eventId ? t("save") : t("createSubmit")}
      </Button>
    </form>
  );
}
