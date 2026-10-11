import { safeRequestId } from "@/lib/logging/catalog";
import { recordApplicationLog } from "@/lib/logging/logger";

const AUTH_PATHS = ["/sign-in/email", "/change-password", "/reset-password"] as const;

export async function recordAuthRoute(request: Request, status: number) {
  let pathname = "";

  try {
    pathname = new URL(request.url).pathname;
  } catch {
    return;
  }

  const path = AUTH_PATHS.find((item) => pathname.endsWith(item));

  if (!path) {
    return;
  }

  const requestId = safeRequestId(
    request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id"),
  );
  const succeeded = status >= 200 && status < 300;

  if (path === "/sign-in/email") {
    await recordApplicationLog({
      eventType: succeeded ? "auth.login.succeeded" : "auth.login.failed",
      actorType: "anonymous",
      result: succeeded ? "success" : "failure",
      requestId,
      metadata: succeeded ? {} : { reason: "invalid_credentials" },
    });
    return;
  }

  await recordApplicationLog({
    eventType: path === "/change-password" ? "auth.password.changed" : "auth.password.reset",
    actorType: "anonymous",
    result: succeeded ? "success" : "failure",
    requestId,
    metadata: succeeded ? {} : { reason: "invalid_password" },
  });
}
