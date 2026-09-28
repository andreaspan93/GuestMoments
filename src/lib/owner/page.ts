import { forbidden } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getRequestSession } from "@/lib/session";

export async function requireOwnerPage(locale: string) {
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    throw new Error("Redirect");
  }

  if (session.user.role !== "OWNER") {
    forbidden();
  }

  return session.user;
}
