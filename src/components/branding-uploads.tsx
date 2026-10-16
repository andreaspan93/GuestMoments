"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePicker } from "@/components/file-picker";
import { buttonVariants } from "@/components/ui/button";
import {
  brandingSlots,
  removeBrandingFile,
  uploadBrandingFile,
  type BrandingSlot,
} from "@/lib/uploads/branding-client";

export function BrandingUploads({
  eventId,
  previews,
  disabled = false,
  uploadOnSave = false,
  onStagedChange,
}: {
  eventId?: string;
  previews?: {
    cover: string | null;
    logo: string | null;
    background: string | null;
  };
  disabled?: boolean;
  uploadOnSave?: boolean;
  onStagedChange?: (files: Partial<Record<BrandingSlot, File>>) => void;
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [localPreviews, setLocalPreviews] = useState<Partial<Record<BrandingSlot, string>>>({});
  const [cleared, setCleared] = useState<Partial<Record<BrandingSlot, boolean>>>({});
  const [pickerGeneration, setPickerGeneration] = useState<Partial<Record<BrandingSlot, number>>>(
    {},
  );
  const staged = useRef<Partial<Record<BrandingSlot, File>>>({});
  const previewUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = previewUrls.current;

    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function stage(slot: BrandingSlot, file: File) {
    const next = { ...staged.current, [slot]: file };
    staged.current = next;
    onStagedChange?.(next);
    const previewUrl = URL.createObjectURL(file);
    previewUrls.current.push(previewUrl);
    setLocalPreviews((current) => {
      const previous = current[slot];

      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return { ...current, [slot]: previewUrl };
    });
  }

  async function upload(slot: BrandingSlot, file: File) {
    if (!eventId || uploadOnSave) {
      stage(slot, file);
      return;
    }

    setPendingSlot(slot);
    setMessage(null);

    try {
      await uploadBrandingFile(eventId, slot, file);
      setMessage(t("brandingSaved"));
      router.refresh();
    } catch {
      setMessage(t("brandingFailed"));
    } finally {
      setPendingSlot(null);
    }
  }

  function clearStaged(slot: BrandingSlot) {
    if (staged.current[slot]) {
      const next = { ...staged.current };
      delete next[slot];
      staged.current = next;
      onStagedChange?.(next);
    }

    setLocalPreviews((current) => {
      const previous = current[slot];

      if (previous) {
        URL.revokeObjectURL(previous);
      }

      return { ...current, [slot]: undefined };
    });
    setPickerGeneration((current) => ({
      ...current,
      [slot]: (current[slot] ?? 0) + 1,
    }));
  }

  async function remove(slot: BrandingSlot) {
    const hasStored = Boolean(previews?.[slot]) && !cleared[slot];
    clearStaged(slot);

    if (!eventId || !hasStored) {
      return;
    }

    setCleared((current) => ({ ...current, [slot]: true }));
    setPendingSlot(slot);
    setMessage(null);

    try {
      await removeBrandingFile(eventId, slot);
      setMessage(t("brandingRemoved"));
      router.refresh();
    } catch {
      setCleared((current) => ({ ...current, [slot]: false }));
      setMessage(t("brandingRemoveFailed"));
    } finally {
      setPendingSlot(null);
    }
  }

  return (
    <section className="mt-2 grid gap-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">{t("brandingTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/80">{t("brandingLead")}</p>
      </div>
      {brandingSlots.map((slot) => {
        const label = slot === "background" ? t("backgroundImage") : t(slot);
        const storedPreview = cleared[slot] ? null : (previews?.[slot] ?? null);
        const preview = localPreviews[slot] ?? storedPreview;

        return (
          <div key={slot} className="grid gap-2 text-sm font-medium">
            <span>{label}</span>
            {preview ? (
              // Signed storage URL or a local preview; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="max-h-40 w-full rounded-2xl object-cover" src={preview} alt="" />
            ) : null}
            <FilePicker
              key={`${slot}-${pickerGeneration[slot] ?? 0}`}
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={disabled || pendingSlot !== null}
              buttonLabel={t("chooseFile")}
              formatSelection={(files) => files[0]?.name ?? ""}
              onFiles={(files) => {
                const file = files?.[0];

                if (file) {
                  void upload(slot, file);
                }
              }}
            />
            {preview ? (
              <button
                type="button"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                disabled={disabled || pendingSlot !== null}
                onClick={() => {
                  void remove(slot);
                }}
              >
                {t("removeImage")}
              </button>
            ) : null}
            {pendingSlot === slot ? <span>{t("pending")}</span> : null}
          </div>
        );
      })}
      {message ? (
        <p role="status" className="text-sm text-foreground/80">
          {message}
        </p>
      ) : null}
    </section>
  );
}
