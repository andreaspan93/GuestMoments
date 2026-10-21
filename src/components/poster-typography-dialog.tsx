"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { eventFontGroups, eventFonts } from "@/lib/events/appearance";
import { updatePosterTypographyAction, type PosterTypographyResult } from "@/lib/events/actions";
import {
  posterSizeMaxMm,
  posterSizeMinMm,
  posterTypographySchema,
  type PosterTypography,
} from "@/lib/events/poster-typography";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

const rows = [
  { label: "qrTypographyName", font: "nameFont", size: "nameSizeMm" },
  { label: "qrTypographyDate", font: "dateFont", size: "dateSizeMm" },
  { label: "qrTypographyKicker", font: "kickerFont", size: "kickerSizeMm" },
  { label: "qrTypographyScript", font: "scriptFont", size: "scriptSizeMm" },
] as const;

type FontKey = (typeof rows)[number]["font"];
type SizeKey = (typeof rows)[number]["size"];

function clampSize(value: number) {
  if (!Number.isFinite(value)) {
    return posterSizeMinMm;
  }

  const rounded = Math.round(value * 100) / 100;
  return Math.min(posterSizeMaxMm, Math.max(posterSizeMinMm, rounded));
}

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
  const menuRef = useRef<HTMLUListElement>(null);
  const [draft, setDraft] = useState(typography);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [openFont, setOpenFont] = useState<FontKey | null>(null);
  const [menuBox, setMenuBox] = useState({ top: 0, left: 0, width: 0 });
  const nameLabelId = useId();
  const dateLabelId = useId();
  const kickerLabelId = useId();
  const scriptLabelId = useId();
  const labelIds: Record<FontKey, string> = {
    nameFont: nameLabelId,
    dateFont: dateLabelId,
    kickerFont: kickerLabelId,
    scriptFont: scriptLabelId,
  };
  const closeMenu = useCallback(() => setOpenFont(null), []);

  useEffect(() => {
    if (!openFont) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      const button = dialogRef.current?.querySelector(`[aria-controls="poster-font-menu"]`);

      if (button?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }

      closeMenu();
    }

    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openFont, closeMenu]);

  function open() {
    setDraft(typography);
    setError(false);
    setOpenFont(null);
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    dialog.showModal();
    dialog.focus();
  }

  function close() {
    setOpenFont(null);
    dialogRef.current?.close();
  }

  function openMenu(key: FontKey, anchor: DOMRect) {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const dialogRect = dialog.getBoundingClientRect();
    const menuHeight = 240;
    const width = Math.min(Math.max(anchor.width, 240), dialogRect.width - 16);
    let left = anchor.left - dialogRect.left;

    if (left + width > dialogRect.width - 8) {
      left = Math.max(8, dialogRect.width - 8 - width);
    }

    const spaceBelow = window.innerHeight - anchor.bottom;
    const below = anchor.bottom - dialogRect.top + 8;
    const above = anchor.top - dialogRect.top - 8 - menuHeight;

    setMenuBox({
      top: spaceBelow < menuHeight && anchor.top > spaceBelow ? Math.max(8, above) : below,
      left,
      width,
    });
    setOpenFont(key);
  }

  function changeSize(key: SizeKey, delta: number) {
    setDraft((current) => ({
      ...current,
      [key]: clampSize(current[key] + delta),
    }));
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = {
      ...draft,
      nameSizeMm: clampSize(draft.nameSizeMm),
      dateSizeMm: clampSize(draft.dateSizeMm),
      kickerSizeMm: clampSize(draft.kickerSizeMm),
      scriptSizeMm: clampSize(draft.scriptSizeMm),
    };
    const parsed = posterTypographySchema.safeParse(normalized);

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

  const openRow = rows.find((row) => row.font === openFont);

  return (
    <>
      <Button type="button" variant="outline" size="sm" aria-label={t("qrTypographyEdit")} onClick={open}>
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <dialog
        ref={dialogRef}
        tabIndex={-1}
        aria-labelledby="poster-typography-title"
        className="m-auto w-[min(36rem,calc(100vw-2rem))] overflow-visible rounded-3xl border border-border bg-card text-foreground shadow-xl outline-none backdrop:bg-foreground/40"
        style={{ overflow: "visible" }}
        onCancel={(event) => {
          if (openFont) {
            event.preventDefault();
            closeMenu();
          }
        }}
      >
        <div
          className="max-h-[min(40rem,calc(100dvh-2rem))] overflow-y-auto p-5 sm:p-6"
          onScroll={closeMenu}
        >
          <form onSubmit={onSubmit} className="grid gap-4">
            <div>
              <h2 id="poster-typography-title" className="text-lg font-semibold tracking-tight">
                {t("qrTypographyTitle")}
              </h2>
              <p className="mt-1 text-sm leading-6 text-foreground/80">{t("qrTypographyLead")}</p>
            </div>
            {rows.map((row) => {
              const size = draft[row.size];
              const open = openFont === row.font;
              const selected = eventFonts.find((font) => font.id === draft[row.font]) ?? eventFonts[0];

              return (
                <fieldset key={row.font} className="grid gap-2 border-0 p-0">
                  <legend className="text-sm font-medium">{t(row.label)}</legend>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
                    <div className="grid min-w-0 gap-1">
                      <span id={labelIds[row.font]} className="text-xs text-foreground/70">
                        {t("qrTypographyFont")}
                      </span>
                      <button
                        type="button"
                        className={`${fieldClassName} flex w-full min-w-0 items-center justify-between gap-2 text-left`}
                        style={{ fontFamily: selected.family, fontWeight: selected.weight }}
                        aria-labelledby={labelIds[row.font]}
                        aria-haspopup="listbox"
                        aria-expanded={open}
                        aria-controls={open ? "poster-font-menu" : undefined}
                        disabled={pending}
                        onClick={(event) => {
                          if (open) {
                            closeMenu();
                            return;
                          }

                          openMenu(row.font, event.currentTarget.getBoundingClientRect());
                        }}
                      >
                        <span className="truncate">{selected.label}</span>
                        <span aria-hidden="true" className="font-sans text-xs">
                          ▾
                        </span>
                      </button>
                    </div>
                    <div className="grid gap-1">
                      <span className="text-xs text-foreground/70">{t("qrTypographySize")}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="size-10 shrink-0 px-0 text-lg"
                          aria-label={t("qrTypographyDecrease")}
                          disabled={pending || size <= posterSizeMinMm}
                          onClick={() => changeSize(row.size, -1)}
                        >
                          −
                        </Button>
                        <input
                          className="h-10 w-20 rounded-full border border-border bg-background px-2 text-center text-base text-foreground outline-none [appearance:textfield] focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          type="number"
                          inputMode="decimal"
                          min={posterSizeMinMm}
                          max={posterSizeMaxMm}
                          step={0.1}
                          value={size}
                          aria-label={`${t(row.label)} ${t("qrTypographySize")}`}
                          disabled={pending}
                          onChange={(change) => {
                            const next = Number(change.target.value);

                            if (Number.isFinite(next)) {
                              setDraft((current) => ({ ...current, [row.size]: next }));
                            }
                          }}
                          onBlur={() => {
                            setDraft((current) => ({ ...current, [row.size]: clampSize(current[row.size]) }));
                          }}
                          required
                        />
                        <Button
                          type="button"
                          variant="outline"
                          className="size-10 shrink-0 px-0 text-lg"
                          aria-label={t("qrTypographyIncrease")}
                          disabled={pending || size >= posterSizeMaxMm}
                          onClick={() => changeSize(row.size, 1)}
                        >
                          +
                        </Button>
                      </div>
                    </div>
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
        </div>
        {openRow ? (
          <ul
            ref={menuRef}
            id="poster-font-menu"
            role="listbox"
            aria-labelledby={labelIds[openRow.font]}
            className="absolute z-30 max-h-60 overflow-auto rounded-3xl border border-border bg-background p-1 shadow-lg"
            style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
          >
            {eventFontGroups.map((group) => (
              <li key={group} role="presentation">
                <p className="px-4 pt-2 pb-1 font-sans text-xs font-medium tracking-wide text-foreground/60 uppercase">
                  {t(`fontGroups.${group}`)}
                </p>
                <ul role="presentation">
                  {eventFonts
                    .filter((font) => font.group === group)
                    .map((font) => (
                      <li key={font.id} role="none">
                        <button
                          type="button"
                          role="option"
                          aria-selected={font.id === draft[openRow.font]}
                          className="w-full rounded-2xl px-4 py-2 text-left text-base hover:bg-muted"
                          style={{ fontFamily: font.family, fontWeight: font.weight }}
                          onClick={() => {
                            setDraft((current) => ({ ...current, [openRow.font]: font.id }));
                            closeMenu();
                          }}
                        >
                          {font.label}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : null}
      </dialog>
    </>
  );
}
