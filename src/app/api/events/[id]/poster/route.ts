import { getCustomerEvent } from "@/lib/events/service";
import { guestEventUrl } from "@/lib/events/code";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";
import { fitPosterPdfToA7 } from "@/lib/events/poster-paper";
import { parsePosterPaper, parseQrDesign, sharePosterCopy, sharePosterDate } from "@/lib/events/qr-design";
import { renderEventQr } from "@/lib/events/qr";
import { resolvePosterTypography } from "@/lib/events/poster-typography";
import { buildSharePosterPdf } from "@/lib/events/share-poster-pdf";
import { getRequestSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

function imageContentType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return "image/jpeg";
  }

  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return "image/png";
  }

  if (bytes[0] === 0x52 && bytes[1] === 0x49) {
    return "image/webp";
  }

  return "application/octet-stream";
}

async function sharePoster(
  name: string,
  dateLabel: string,
  locale: "en" | "el",
  qrPromise: ReturnType<typeof renderEventQr>,
  typography: ReturnType<typeof resolvePosterTypography>,
) {
  return buildSharePosterPdf({
    name,
    dateLabel,
    ...sharePosterCopy(locale),
    qr: { bytes: new Uint8Array(await qrPromise) },
    typography,
  });
}

async function classicPoster(
  event: {
    name: string;
    eventDate: Date;
    logoSize: string;
    logoCorner: string;
    coverKey: string | null;
    logoKey: string | null;
    posterTypography: unknown;
  },
  locale: "en" | "el",
  qrPromise: ReturnType<typeof renderEventQr>,
) {
  const typography = resolvePosterTypography(event.posterTypography);
  const [cover, logo, qr] = await Promise.all([
    imageBytes(event.coverKey),
    imageBytes(event.logoKey),
    qrPromise,
  ]);

  return buildPosterPdf({
    name: event.name,
    titleFont: typography.nameFont,
    nameSizeMm: typography.nameSizeMm,
    dateFont: typography.dateFont,
    dateSizeMm: typography.dateSizeMm,
    dateLabel: formatCalendarDate(calendarDateFromDb(event.eventDate), locale),
    cta: posterCta(locale),
    locale,
    logoSize: event.logoSize,
    logoCorner: event.logoCorner,
    cover,
    logo,
    qr: { bytes: new Uint8Array(qr) },
  });
}

async function imageBytes(key: string | null) {
  if (!key) {
    return null;
  }

  const storage = getStorage();

  if (!storage.getObject) {
    return null;
  }

  try {
    const bytes = await storage.getObject(key);

    return bytes ? { bytes } : null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getRequestSession();

  if (!session) {
    return new Response(null, { status: 401 });
  }

  const { id } = await context.params;
  const event = await getCustomerEvent(session.user, id);

  if (!event) {
    return new Response(null, { status: 404 });
  }

  const url = new URL(request.url);
  const asset = url.searchParams.get("asset");

  if (asset === "cover" || asset === "logo") {
    const image = await imageBytes(asset === "cover" ? event.coverKey : event.logoKey);

    if (!image) {
      return new Response(null, { status: 404 });
    }

    return new Response(Buffer.from(image.bytes), {
      headers: {
        "Content-Type": imageContentType(image.bytes),
        "Cache-Control": "private, no-store",
      },
    });
  }

  const locale = url.searchParams.get("locale") === "el" ? "el" : "en";
  const design = parseQrDesign(url.searchParams.get("design"));
  const paper = parsePosterPaper(url.searchParams.get("paper"));
  const typography = resolvePosterTypography(event.posterTypography);
  const qrPromise = renderEventQr(guestEventUrl(event.uniqueCode));
  const poster =
    design === "b"
      ? await sharePoster(
          event.name,
          sharePosterDate(calendarDateFromDb(event.eventDate), locale),
          locale,
          qrPromise,
          typography,
        )
      : await classicPoster(event, locale, qrPromise);
  const pdf = paper === "a7" ? await fitPosterPdfToA7(poster) : poster;
  const filename =
    design === "b"
      ? paper === "a7"
        ? "guestmoments-share-a7.pdf"
        : "guestmoments-share-a5.pdf"
      : paper === "a7"
        ? "guestmoments-a7.pdf"
        : "guestmoments-a5.pdf";

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
