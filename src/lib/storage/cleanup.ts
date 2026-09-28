import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";

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

async function purgeExpiredEvents(storage: IStorageService, now: Date) {
  let purgedEvents = 0;

  for (;;) {
    const due = await prisma.event.findMany({
      where: {
        expiresAt: { lte: now },
        storagePurgedAt: null,
      },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: PURGE_BATCH,
    });

    if (due.length === 0) {
      return purgedEvents;
    }

    for (const event of due) {
      await storage.deletePrefix(eventStoragePrefix(event.id));
      await prisma.$transaction([
        prisma.media.deleteMany({ where: { eventId: event.id } }),
        prisma.uploadIntent.deleteMany({ where: { eventId: event.id } }),
        prisma.event.update({
          where: { id: event.id },
          data: {
            status: "EXPIRED",
            storagePurgedAt: now,
            coverKey: null,
            logoKey: null,
            backgroundImageKey: null,
          },
        }),
      ]);
      purgedEvents += 1;
    }
  }
}

export async function runStorageCleanup(
  storage: IStorageService,
  now = new Date(),
) {
  const abandonedIntents = await cleanupAbandonedUploads(storage, now);
  const purgedEvents = await purgeExpiredEvents(storage, now);

  return { abandonedIntents, purgedEvents };
}
