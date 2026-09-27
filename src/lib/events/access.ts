export type GuestAccessState = "ok" | "not_found" | "unavailable";

export function decideGuestAccess(
  event: {
    status: string;
    expiresAt: Date;
    customerDisabled: boolean;
  } | null,
  now: Date,
): { state: GuestAccessState } {
  if (!event) {
    return { state: "not_found" };
  }

  if (
    event.status !== "ACTIVE" ||
    event.customerDisabled ||
    event.expiresAt.getTime() <= now.getTime()
  ) {
    return { state: "unavailable" };
  }

  return { state: "ok" };
}

export function eventScope(actor: { id: string; role: string }) {
  if (actor.role === "OWNER") {
    return {};
  }

  return { customerId: actor.id };
}
