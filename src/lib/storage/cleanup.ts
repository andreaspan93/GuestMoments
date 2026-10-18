import { recordApplicationLog, recordUnexpectedError } from "@/lib/logging/logger";
import { deleteExpiredApplicationLogs } from "@/lib/logging/retention";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";
import {
  deleteConfiguredGuestRateLimits,
  deleteExpiredRateLimitHits,
  eventRateLimitHitWhere,
} from "@/lib/uploads/rate-limit";

const PURGE_BATCH = 20;

async function cleanupAbandonedUploads(storage: IStorageService, now: Date) {
  const stale = await prisma.uploadIntent.findMany({
    where: {
      consumedAt: null,
      expiresAt: { lt: now },
    },
    select: {
      id: true,
      storageKey: true,
    },
  });

  for (const intent of stale) {
    await storage.deleteObject(intent.storageKey);
    await prisma.uploadIntent.delete({
      where: { id: intent.id },
    });
  }

  return stale.length;
}

async function recordPurgeFailure(eventId: string) {
  try {
    await recordApplicationLog({
      eventType: "app.error",
      actorType: "system",
      targetType: "event",
      targetId: eventId,
      result: "failure",
      metadata: { reason: "unexpected", eventId },
    });
  } catch {
    await recordUnexpectedError();
  }
}

async function purgeOneEvent(
  storage: IStorageService,
  event: { id: string; uniqueCode: string },
) {
  try {
    await storage.deletePrefix(eventStoragePrefix(event.id));
  } catch {
    await recordPurgeFailure(event.id);
    return false;
  }

  try {
    const rateLimitWhere = eventRateLimitHitWhere(event.id, event.uniqueCode);
    await prisma.$transaction([
      ...(rateLimitWhere
        ? [prisma.rateLimitHit.deleteMany({ where: rateLimitWhere })]
        : []),
      prisma.event.delete({ where: { id: event.id } }),
    ]);
  } catch {
    await recordPurgeFailure(event.id);
    return false;
  }

  try {
    await deleteConfiguredGuestRateLimits([event.uniqueCode]);
  } catch {
    await recordUnexpectedError();
  }

  try {
    await recordApplicationLog({
      eventType: "event.deleted",
      actorType: "system",
      targetType: "event",
      targetId: event.id,
      result: "success",
    });
  } catch {
    await recordUnexpectedError();
  }

  return true;
}

/**
 * Customer access expiry is the only automatic event deletion. Storage is
 * removed before the event row. A failure leaves that event for the next
 * run and does not re-enable the customer.
 */
async function purgeExpiredCustomers(storage: IStorageService, now: Date) {
  let purgedEvents = 0;
  const due = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      accessExpiresAt: { lte: now },
    },
    select: { id: true },
    orderBy: { accessExpiresAt: "asc" },
    take: PURGE_BATCH,
  });
  let incomplete = false;

  for (const candidate of due) {
    const current = await prisma.user.findUnique({
      where: { id: candidate.id },
      select: { id: true, role: true, accessExpiresAt: true },
    });

    if (
      !current ||
      current.role !== "CUSTOMER" ||
      !current.accessExpiresAt ||
      current.accessExpiresAt.getTime() > now.getTime()
    ) {
      continue;
    }

    await prisma.user.updateMany({
      where: {
        id: current.id,
        role: "CUSTOMER",
        accessExpiresAt: { lte: now },
      },
      data: { disabled: true, accessStatus: "EXPIRED" },
    });
    await prisma.session.deleteMany({ where: { userId: current.id } });

    const stillExpired = await prisma.user.findUnique({
      where: { id: current.id },
      select: { accessExpiresAt: true, disabled: true },
    });

    if (
      !stillExpired?.accessExpiresAt ||
      stillExpired.accessExpiresAt.getTime() > now.getTime() ||
      !stillExpired.disabled
    ) {
      continue;
    }

    const events = await prisma.event.findMany({
      where: { customerId: current.id },
      select: { id: true, uniqueCode: true },
    });

    for (const event of events) {
      if (await purgeOneEvent(storage, event)) {
        purgedEvents += 1;
      } else {
        incomplete = true;
      }
    }
  }

  return { purgedEvents, incomplete };
}

export async function runStorageCleanup(
  storage: IStorageService,
  now = new Date(),
) {
  const abandonedIntents = await cleanupAbandonedUploads(storage, now);
  const purge = await purgeExpiredCustomers(storage, now);
  let expiredLogs = { operational: 0, security: 0, authFailure: 0 };

  try {
    expiredLogs = await deleteExpiredApplicationLogs(now);
  } catch {
    expiredLogs = { operational: 0, security: 0, authFailure: 0 };
  }

  const expiredSessions = await prisma.session.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const expiredVerifications = await prisma.verification.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  const expiredRateLimits = await deleteExpiredRateLimitHits(now);

  if (purge.incomplete) {
    throw new Error("event_cleanup_incomplete");
  }

  return {
    abandonedIntents,
    purgedEvents: purge.purgedEvents,
    expiredLogs,
    expiredSessions: expiredSessions.count,
    expiredVerifications: expiredVerifications.count,
    expiredRateLimits,
  };
}
