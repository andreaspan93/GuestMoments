import { readOwnerCounts, respondOwner } from "@/lib/owner/http";
import { getRequestSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET() {
  const session = await getRequestSession();

  return respondOwner(() => readOwnerCounts(session?.user ?? null));
}