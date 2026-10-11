import { isInternalId } from "@/lib/logging/catalog";
import { recordApplicationLog } from "@/lib/logging/logger";
import { prisma } from "@/lib/prisma";

export async function recordCrossCustomerEventAccess(
  actor: { id: string; role: string },
  eventId: string,
) {
  if (actor.role === "OWNER" || !isInternalId(actor.id) || !isInternalId(eventId)) {
    return;
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, customerId: true },
    });

    if (!event || event.customerId === actor.id) {
      return;
    }

    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "customer",
      actorId: actor.id,
      targetType: "event",
      targetId: event.id,
      result: "denied",
      metadata: { reason: "forbidden" },
    });
  } catch {
    return;
  }
}
