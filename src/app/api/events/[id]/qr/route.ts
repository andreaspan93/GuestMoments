import { getRequestSession } from "@/lib/session";
import { getCustomerEvent } from "@/lib/events/service";
import { renderEventQr } from "@/lib/events/qr";
import { guestEventUrl } from "@/lib/events/code";

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

  const png = await renderEventQr(guestEventUrl(event.uniqueCode));
  const download = new URL(request.url).searchParams.get("download") === "1";

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="guestmoments-${event.uniqueCode}.png"`,
    },
  });
}
