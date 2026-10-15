"use client";

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
      <label className="grid gap-2 text-sm font-medium">
        {t("titleFont")}
        <select className={fieldClassName} name="titleFont" defaultValue={titleFont}>
          {eventFonts.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("guestFont")}
        <select className={fieldClassName} name="guestFont" defaultValue={guestFont}>
          {eventFonts.map((font) => (
            <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
              {font.label}
            </option>
          ))}
        </select>
      </label>
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
