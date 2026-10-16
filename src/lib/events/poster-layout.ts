/** Millimetres represented by 1cqh when the poster container is a full 210mm A5 page. */
export const POSTER_PAGE_CQH_MM = 2.1;

export const POSTER_PAD_X_MM = 11;
export const POSTER_PAD_TOP_MM = 11;
export const POSTER_PAD_BOTTOM_MM = 12;

/** Share of leftover vertical space kept above the poster stack. */
export const POSTER_TOP_FREE_SHARE = 0.12;

/** Short event names use this size. It is 8cqh on a full A5 page. */
export const POSTER_TITLE_MAX_MM = 16.8;

export const POSTER_DATE_SIZE_MM = 6.2;

/** Space between the title and the date. */
export const POSTER_DATE_GAP_MM = 6;

/** Space between the date and the event photo. */
export const POSTER_PHOTO_GAP_MM = 10;

export const POSTER_STACK_GAP_MM = 3.4;
export const POSTER_QR_GAP_MM = 3.4 + 2.2;
export const POSTER_CTA_GAP_MM = 3.4 + 1.4;

export const POSTER_COVER_MM = 62;
export const POSTER_COVER_CAP_CQH = 30;
export const POSTER_COVER_WITH_LOGO_MM = 30;
export const POSTER_COVER_WITH_LOGO_CAP_CQH = 15;

export const POSTER_QR_MM = 44;
export const POSTER_QR_CAP_CQH = 21;
export const POSTER_QR_WITH_LOGO_MM = 38;
export const POSTER_QR_WITH_LOGO_CAP_CQH = 18;

export const POSTER_CTA_MM = 3.15;
export const POSTER_CTA_CAP_CQH = 1.6;

/** Size used on a full A5 page, where cqh and mm caps both apply. */
export function posterFullPageMm(valueMm: number, capCqh: number) {
  return Math.min(valueMm, capCqh * POSTER_PAGE_CQH_MM);
}

function cssNumber(value: number) {
  return String(Math.round(value * 1000) / 1000);
}

/** CSS variables shared with the A5 PDF so the QR page uses the same spacing. */
export function posterFrameStyle(): Record<string, string> {
  return {
    "--poster-pad-x": `${POSTER_PAD_X_MM}mm`,
    "--poster-pad-top": `${POSTER_PAD_TOP_MM}mm`,
    "--poster-pad-bottom": `${POSTER_PAD_BOTTOM_MM}mm`,
    "--poster-date-gap": `${POSTER_DATE_GAP_MM}mm`,
    "--poster-date-gap-cqh": `${cssNumber(POSTER_DATE_GAP_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-photo-gap": `${POSTER_PHOTO_GAP_MM}mm`,
    "--poster-photo-gap-cqh": `${cssNumber(POSTER_PHOTO_GAP_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-stack-gap": `${POSTER_STACK_GAP_MM}mm`,
    "--poster-stack-gap-cqh": `${cssNumber(POSTER_STACK_GAP_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-qr-gap": `${POSTER_QR_GAP_MM}mm`,
    "--poster-qr-gap-cqh": `${cssNumber(POSTER_QR_GAP_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-cta-gap": `${POSTER_CTA_GAP_MM}mm`,
    "--poster-cta-gap-cqh": `${cssNumber(POSTER_CTA_GAP_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-date-size": `${POSTER_DATE_SIZE_MM}mm`,
    "--poster-date-size-cqh": `${cssNumber(POSTER_DATE_SIZE_MM / POSTER_PAGE_CQH_MM)}cqh`,
    "--poster-cover": `${POSTER_COVER_MM}mm`,
    "--poster-cover-cap": `${POSTER_COVER_CAP_CQH}cqh`,
    "--poster-cover-logo": `${POSTER_COVER_WITH_LOGO_MM}mm`,
    "--poster-cover-logo-cap": `${POSTER_COVER_WITH_LOGO_CAP_CQH}cqh`,
    "--poster-qr": `${POSTER_QR_MM}mm`,
    "--poster-qr-cap": `${POSTER_QR_CAP_CQH}cqh`,
    "--poster-qr-logo": `${POSTER_QR_WITH_LOGO_MM}mm`,
    "--poster-qr-logo-cap": `${POSTER_QR_WITH_LOGO_CAP_CQH}cqh`,
    "--poster-cta": `${POSTER_CTA_MM}mm`,
    "--poster-cta-cap": `${POSTER_CTA_CAP_CQH}cqh`,
  };
}
