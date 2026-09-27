import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";

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

export async function runStorageCleanup(
  storage: IStorageService,
  now = new Date(),
) {
  await cleanupAbandonedUploads(storage, now);
}
