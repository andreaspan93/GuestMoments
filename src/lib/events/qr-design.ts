import el from "../../../messages/el.json";
import en from "../../../messages/en.json";

export type QrDesign = "a" | "b";

export function parseQrDesign(value: string | null | undefined): QrDesign {
  return value === "b" ? "b" : "a";
}

/** Spaced numeric date for Design B, in the locale's day/month order. */
export function sharePosterDate(isoDate: string, locale: "en" | "el") {
  const [year, month, day] = isoDate.split("-");

  if (!year || !month || !day) {
    return isoDate;
  }

  const parts = locale === "en" ? [month, day, year] : [day, month, year];

  return parts.join(". ");
}

export function sharePosterCopy(locale: "en" | "el") {
  const events = locale === "el" ? el.events : en.events;

  return {
    kicker: events.qrShareKicker,
    script: events.qrShareScript,
    line1: events.qrShareLine1,
    line2: events.qrShareLine2,
  };
}

export function posterPdfPath(eventId: string, locale: string, design: QrDesign) {
  return `/api/events/${eventId}/poster?locale=${locale}&design=${design}`;
}

export function posterPngFilename(design: QrDesign) {
  return design === "b" ? "guestmoments-share.png" : "guestmoments-poster.png";
}
