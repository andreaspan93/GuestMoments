import { getCustomerEvent } from "@/lib/events/service";
import { guestEventUrl } from "@/lib/events/code";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { buildPosterPdf, posterCta } from "@/lib/events/poster-pdf";
import { renderEventQr } from "@/lib/events/qr";
import { getRequestSession } from "@/lib/session";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

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

  const locale = new URL(request.url).searchParams.get("locale") === "el" ? "el" : "en";
  const [cover, logo] = await Promise.all([
    imageBytes(event.coverKey),
    imageBytes(event.logoKey),
  ]);
  const qr = await renderEventQr(guestEventUrl(event.uniqueCode));
  const pdf = await buildPosterPdf({
    name: event.name,
    dateLabel: formatCalendarDate(calendarDateFromDb(event.eventDate), locale),
    cta: posterCta(locale),
    locale,
    logoSize: event.logoSize,
    logoCorner: event.logoCorner,
    cover,
    logo,
    qr: { bytes: new Uint8Array(qr) },
  });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "private, no-store",
      "Content-Disposition": 'attachment; filename="guestmoments-a5.pdf"',
    },
  });
}
