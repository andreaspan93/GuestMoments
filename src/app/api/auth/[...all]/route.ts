import { auth } from "@/lib/auth";
import { recordAuthRoute } from "@/lib/logging/auth-route";
import { toNextJsHandler } from "better-auth/next-js";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  const response = await handler.POST(request);

  await recordAuthRoute(request, response.status);

  return response;
}
