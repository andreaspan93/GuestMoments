import el from "../../../messages/el.json";
import en from "../../../messages/en.json";

export type QrDesign = "a" | "b" | "c";
export type PosterPaper = "a5" | "a7" | "a8";

export function parseQrDesign(value: string | null | undefined): QrDesign {
  if (value === "b" || value === "c") {
    return value;
  }

  return "a";
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

export function parsePosterPaper(value: string | null | undefined): PosterPaper {
  return value === "a7" ? "a7" : "a5";
}

/** Design C is landscape A8 only. Designs A and B stay A5, with A7 as the smaller option. */
export function paperForDesign(design: QrDesign, value: string | null | undefined): PosterPaper {
  if (design === "c") {
    return "a8";
  }

  return parsePosterPaper(value);
}

export function posterPdfPath(
  eventId: string,
  locale: string,
  design: QrDesign,
  paper: PosterPaper = "a5",
) {
  const selected = paperForDesign(design, paper);
  const path = `/api/events/${eventId}/poster?locale=${locale}&design=${design}`;

  return selected === "a5" ? path : `${path}&paper=${selected}`;
}

export function posterPngFilename(design: QrDesign) {
  if (design === "b") {
    return "guestmoments-share.png";
  }

  if (design === "c") {
    return "guestmoments-card.png";
  }

  return "guestmoments-poster.png";
}
