"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePicker } from "@/components/file-picker";
import { putBytesWithRetry } from "@/lib/uploads/transfer";

const slots = ["cover", "logo", "background"] as const;

export function BrandingUploads({
  eventId,
  previews,
}: {
  eventId: string;
  previews: {
    cover: string | null;
    logo: string | null;
    background: string | null;
  };
}) {
  const t = useTranslations("events");
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);

  async function upload(slot: (typeof slots)[number], file: File) {
    setPendingSlot(slot);
    setMessage(null);

    try {
      const response = await fetch(`/api/events/${eventId}/branding`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slot,
          fileName: file.name,
          contentType: file.type,
          contentLength: file.size,
        }),
      });
      const body = (await response.json()) as {
        error?: string;
        intentId?: string;
        url?: string;
        headers?: { "Content-Type": string };
      };

      if (!response.ok || !body.intentId || !body.url || !body.headers) {
        throw new Error(body.error ?? "intent");
      }

      await putBytesWithRetry(body.url, file, body.headers["Content-Type"], 1, () => {});
      const complete = await fetch(
        `/api/events/${eventId}/branding/${body.intentId}/complete`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      );

      if (!complete.ok) {
        throw new Error("intent");
      }

      setMessage(t("brandingSaved"));
      router.refresh();
    } catch {
      setMessage(t("brandingFailed"));
    } finally {
      setPendingSlot(null);
    }
  }

  return (
    <section className="mt-10 grid gap-4 border-t border-border pt-8">
      <div>
        <h2 className="text-lg font-semibold">{t("brandingTitle")}</h2>
        <p className="mt-2 text-sm leading-6 text-foreground/80">{t("brandingLead")}</p>
      </div>
      {slots.map((slot) => {
        const label = slot === "background" ? t("backgroundImage") : t(slot);
        const preview = previews[slot];

        return (
          <label key={slot} className="grid gap-2 text-sm font-medium">
            {label}
            {preview ? (
              // Signed storage URL; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="max-h-40 w-full rounded-2xl object-cover" src={preview} alt="" />
            ) : null}
            <FilePicker
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
              disabled={pendingSlot !== null}
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
