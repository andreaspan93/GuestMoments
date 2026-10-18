export type GuestAccessState = "ok" | "not_found" | "unavailable";

export function decideGuestAccess(
  event: {
    status: string;
    customerDisabled: boolean;
    customerAccessExpiresAt: Date | null;
  } | null,
  now: Date,
): { state: GuestAccessState } {
  if (!event) {
    return { state: "not_found" };
  }

  const accessLapsed = Boolean(
    event.customerAccessExpiresAt &&
      event.customerAccessExpiresAt.getTime() <= now.getTime(),
  );

  if (event.status !== "ACTIVE" || event.customerDisabled || accessLapsed) {
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
