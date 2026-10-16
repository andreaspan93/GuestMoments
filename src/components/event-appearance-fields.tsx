"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  eventFonts,
  logoCorners,
  logoSizes,
  type EventFontId,
  type LogoCorner,
  type LogoSize,
} from "@/lib/events/appearance";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FontField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: EventFontId;
}) {
  const [selected, setSelected] = useState(value);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const selectedFont = eventFonts.find((font) => font.id === selected) ?? eventFonts[0];

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative grid gap-2 text-sm font-medium">
      <span id={labelId}>{label}</span>
      <input type="hidden" name={name} value={selected} />
      <button
        type="button"
        className={`${fieldClassName} flex w-full items-center justify-between text-left`}
        style={{ fontFamily: selectedFont.family, fontWeight: selectedFont.weight }}
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selectedFont.label}</span>
        <span aria-hidden="true" className="font-sans text-xs">
          ▾
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-labelledby={labelId}
          className="absolute top-full z-20 mt-2 max-h-72 w-full overflow-auto rounded-3xl border border-border bg-background p-1 shadow-lg"
        >
          {eventFonts.map((font) => (
            <li key={font.id} role="none">
              <button
                type="button"
                role="option"
                aria-selected={font.id === selected}
                className="w-full rounded-2xl px-4 py-2 text-left text-base hover:bg-muted"
                style={{ fontFamily: font.family, fontWeight: font.weight }}
                onClick={() => {
                  setSelected(font.id);
                  setOpen(false);
                }}
              >
                {font.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function EventAppearanceFields({
  titleFont,
  guestFont,
  logoSize,
  logoCorner,
}: {
  titleFont: EventFontId;
  guestFont: EventFontId;
  logoSize: LogoSize;
  logoCorner: LogoCorner;
}) {
  const t = useTranslations("events");

  return (
    <>
      <FontField name="titleFont" label={t("titleFont")} value={titleFont} />
      <FontField name="guestFont" label={t("guestFont")} value={guestFont} />
      <label className="grid gap-2 text-sm font-medium">
        {t("logoSize")}
        <select className={fieldClassName} name="logoSize" defaultValue={logoSize}>
          {logoSizes.map((size) => (
            <option key={size} value={size}>
              {t(`logoSizes.${size}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("logoCorner")}
        <select className={fieldClassName} name="logoCorner" defaultValue={logoCorner}>
          {logoCorners.map((corner) => (
            <option key={corner} value={corner}>
              {t(`logoCorners.${corner}`)}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
