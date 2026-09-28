import { cronAuthorized } from "@/lib/storage/cron";
import { runStorageCleanup } from "@/lib/storage/cleanup";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!cronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  return Response.json(await runStorageCleanup(getStorage()));
}
