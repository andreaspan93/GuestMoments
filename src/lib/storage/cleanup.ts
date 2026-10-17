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
 * Deletes stored media first. The event row and its related records are
 * removed only after that storage deletion returns. A failure leaves the
 * event due, so the next run retries it. Customer accounts and application
 * logs are not part of this deletion.
 */
async function purgeExpiredEvents(storage: IStorageService, now: Date) {
  let purgedEvents = 0;

  for (;;) {
    const due = await prisma.event.findMany({
      where: { expiresAt: { lte: now } },
      select: { id: true, uniqueCode: true },
      orderBy: { expiresAt: "asc" },
      take: PURGE_BATCH,
    });

    if (due.length === 0) {
      return { purgedEvents, incomplete: false };
    }

    let incomplete = false;

    for (const event of due) {
      if (await purgeOneEvent(storage, event)) {
        purgedEvents += 1;
      } else {
        incomplete = true;
      }
    }

    if (incomplete) {
      return { purgedEvents, incomplete: true };
    }
  }
}

export async function runStorageCleanup(
  storage: IStorageService,
  now = new Date(),
) {
  const abandonedIntents = await cleanupAbandonedUploads(storage, now);
  const purge = await purgeExpiredEvents(storage, now);
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
