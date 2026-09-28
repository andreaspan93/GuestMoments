import { postOwnerEvent, readOwnerEvents, respondOwner } from "@/lib/owner/http";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();

  return respondOwner(() => readOwnerEvents(session?.user ?? null));
}

export async function POST(request: Request) {
  const session = await getRequestSession();
  const body = await request.json().catch(() => null);

  return respondOwner(() => postOwnerEvent(session?.user ?? null, body), 201);
}
