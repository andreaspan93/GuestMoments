"use client";

import { useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { eventFontFamily, eventFontGroups, eventFonts, type EventFontId } from "@/lib/events/appearance";
import { updatePosterTypographyAction, type PosterTypographyResult } from "@/lib/events/actions";
import {
  posterSizeMaxMm,
  posterSizeMinMm,
  posterTypographySchema,
  type PosterTypography,
} from "@/lib/events/poster-typography";

const fieldClassName =
  "h-10 w-full rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const rows = [
  { label: "qrTypographyName", font: "nameFont", size: "nameSizeMm" },
  { label: "qrTypographyDate", font: "dateFont", size: "dateSizeMm" },
  { label: "qrTypographyKicker", font: "kickerFont", size: "kickerSizeMm" },
  { label: "qrTypographyScript", font: "scriptFont", size: "scriptSizeMm" },
] as const;

export function PosterTypographyDialog({
  eventId,
  typography,
  onSaved,
}: {
  eventId: string;
  typography: PosterTypography;
  onSaved: (result: Extract<PosterTypographyResult, { ok: true }>) => void;
}) {
  const t = useTranslations("events");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(typography);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  function open() {
    setDraft(typography);
    setError(false);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = posterTypographySchema.safeParse(draft);

    if (!parsed.success) {
      setError(true);
      return;
    }

    setPending(true);
    setError(false);
    const result = await updatePosterTypographyAction(eventId, parsed.data);
    setPending(false);

    if (!result.ok) {
      setError(true);
      return;
    }

    onSaved(result);
    close();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" aria-label={t("qrTypographyEdit")} onClick={open}>
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="poster-typography-title"
        className="m-auto w-[min(32rem,calc(100vw-2rem))] max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto rounded-3xl border border-border bg-card p-5 text-foreground shadow-xl backdrop:bg-foreground/40 sm:p-6"
      >
        <form onSubmit={onSubmit} className="grid gap-4">
          <div>
            <h2 id="poster-typography-title" className="text-lg font-semibold tracking-tight">
              {t("qrTypographyTitle")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-foreground/80">{t("qrTypographyLead")}</p>
          </div>
          {rows.map((row) => {
            const font = draft[row.font];

            return (
              <fieldset key={row.font} className="grid gap-2 border-0 p-0">
                <legend className="text-sm font-medium">{t(row.label)}</legend>
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
                  <label className="grid gap-1 text-xs text-foreground/70">
                    {t("qrTypographyFont")}
                    <select
                      className={fieldClassName}
                      style={{ fontFamily: eventFontFamily(font) }}
                      value={font}
                      onChange={(change) => {
                        setDraft((current) => ({
                          ...current,
                          [row.font]: change.target.value as EventFontId,
                        }));
                      }}
                    >
                      {eventFontGroups.map((group) => (
                        <optgroup key={group} label={t(`fontGroups.${group}`)}>
                          {eventFonts
                            .filter((item) => item.group === group)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.label}
                              </option>
                            ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs text-foreground/70">
                    {t("qrTypographySize")}
                    <input
                      className={fieldClassName}
                      type="number"
                      inputMode="decimal"
                      min={posterSizeMinMm}
                      max={posterSizeMaxMm}
                      step={0.1}
                      value={draft[row.size]}
                      onChange={(change) => {
                        const next = Number(change.target.value);

                        if (Number.isFinite(next)) {
                          setDraft((current) => ({ ...current, [row.size]: next }));
                        }
                      }}
                      required
                    />
                  </label>
                </div>
              </fieldset>
            );
          })}
          {error ? (
            <p role="alert" className="text-sm text-primary">
              {t("qrTypographyError")}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              {t("qrTypographyCancel")}
            </Button>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? t("pending") : t("save")}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
