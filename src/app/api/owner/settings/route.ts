import { patchOwnerSettings, readOwnerSettings, respondOwner } from "@/lib/owner/http";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();

  return respondOwner(() => readOwnerSettings(session?.user ?? null));
}

export async function PATCH(request: Request) {
  const session = await getRequestSession();
  const body = await request.json().catch(() => null);

  return respondOwner(() => patchOwnerSettings(session?.user ?? null, body));
}
