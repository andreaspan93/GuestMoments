"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePicker } from "@/components/file-picker";
import {
  brandingSlots,
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

  return (
    <section className="mt-2 grid gap-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">{t("brandingTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/80">{t("brandingLead")}</p>
      </div>
      {brandingSlots.map((slot) => {
        const label = slot === "background" ? t("backgroundImage") : t(slot);
        const preview = localPreviews[slot] ?? previews?.[slot] ?? null;

        return (
          <label key={slot} className="grid gap-2 text-sm font-medium">
            {label}
            {preview ? (
              // Signed storage URL or a local preview; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="max-h-40 w-full rounded-2xl object-cover" src={preview} alt="" />
            ) : null}
            <FilePicker
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={disabled || pendingSlot !== null}
              buttonLabel={t("chooseFile")}
              emptyLabel={t("noFileSelected")}
              formatSelection={(files) => files[0]?.name ?? t("noFileSelected")}
              onFiles={(files) => {
                const file = files?.[0];

                if (file) {
                  void upload(slot, file);
                }
              }}
            />
            {pendingSlot === slot ? <span>{t("pending")}</span> : null}
          </label>
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
