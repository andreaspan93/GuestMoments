import { randomUUID } from "node:crypto";
import { decideGuestAccess, eventScope } from "@/lib/events/access";
import { customerHasServiceAccess } from "@/lib/access";
import { GalleryError } from "@/lib/gallery/errors";
import { actorTypeForRole, isInternalId } from "@/lib/logging/catalog";
import { recordCrossCustomerEventAccess } from "@/lib/logging/access";
import { recordApplicationLog } from "@/lib/logging/logger";
import {
  exceedsBulkCap,
  formatStorage,
  GALLERY_DOWNLOAD_SECONDS,
  GALLERY_PREVIEW_SECONDS,
  mediaKind,
  toCustomerGalleryItem,
  toGalleryItem,
  uniqueZipNames,
  type AlbumSummary,
  type CustomerGalleryItem,
  type GalleryItem,
} from "@/lib/gallery/present";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { IStorageService } from "@/lib/storage/types";
import { isGuestToken, sanitizeFileName } from "@/lib/uploads/policy";

type Actor = {
  id: string;
  role: string;
};

async function ensureCustomerService(actor: Actor, now: Date) {
  if (actor.role === "OWNER") {
    return;
  }

  if (!(await customerHasServiceAccess(actor, now))) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      result: "denied",
      metadata: { reason: "inactive" },
    });
    throw new GalleryError("inactive");
  }
}

type GalleryEvent = {
  id: string;
  privacyMode: string;
  status: string;
};

const mediaSelect = {
  id: true,
  type: true,
  mimeType: true,
  originalFileName: true,
  size: true,
  guestName: true,
  guestMessage: true,
  createdAt: true,
  isHidden: true,
  isFavorite: true,
  albumId: true,
  storageKey: true,
  thumbnailKey: true,
} as const;

function storeOf(storage?: IStorageService) {
  return storage ?? getStorage();
}

async function signedUrl(
  storage: IStorageService,
  key: string | null,
  seconds: number,
  downloadName?: string,
) {
  if (!key) {
    return null;
  }

  try {
    return await storage.presignGet({
      key,
      expiresInSeconds: seconds,
      downloadName,
    });
  } catch {
    return null;
  }
}

async function presentRow(
  storage: IStorageService,
  row: {
    type: string;
    storageKey: string;
    thumbnailKey: string | null;
  },
) {
  const kind = mediaKind(row.type);
  const playbackUrl = await signedUrl(storage, row.storageKey, GALLERY_PREVIEW_SECONDS);
  const thumbnailUrl = await signedUrl(storage, row.thumbnailKey, GALLERY_PREVIEW_SECONDS);
  const previewUrl =
    kind === "video" ? thumbnailUrl : (thumbnailUrl ?? playbackUrl);

  return { previewUrl, playbackUrl };
}

export async function guestGalleryItems(
  input: {
    event: GalleryEvent;
    customerDisabled: boolean;
    customerAccessExpiresAt: Date | null;
    cookieToken: string | undefined;
    now?: Date;
    storage?: IStorageService;
  },
): Promise<GalleryItem[]> {
  const now = input.now ?? new Date();
  const decision = decideGuestAccess(
    {
      status: input.event.status,
      customerDisabled: input.customerDisabled,
      customerAccessExpiresAt: input.customerAccessExpiresAt,
    },
    now,
  );

  if (decision.state === "not_found") {
    throw new GalleryError("notFound");
  }

  if (decision.state === "unavailable") {
    throw new GalleryError("unavailable");
  }

  const token =
    input.cookieToken && isGuestToken(input.cookieToken) ? input.cookieToken : null;

  if (input.event.privacyMode === "OWN_UPLOADS" && !token) {
    return [];
  }

  const rows = await prisma.media.findMany({
    where: {
      eventId: input.event.id,
      isHidden: false,
      ...(input.event.privacyMode === "OWN_UPLOADS" && token ? { guestToken: token } : {}),
    },
    select: {
      ...mediaSelect,
      guestToken: true,
    },
    orderBy: { createdAt: "desc" },
  });
  const storage = storeOf(input.storage);
  const items: GalleryItem[] = [];

  for (const row of rows) {
    items.push({
      ...toGalleryItem(row, await presentRow(storage, row)),
      owned: Boolean(token) && row.guestToken === token,
    });
  }

  return items;
}

export async function listGuestGallery(
  code: string,
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const loaded = await prisma.event.findUnique({
    where: { uniqueCode: code },
    include: {
      customer: {
        select: { disabled: true, accessExpiresAt: true },
      },
    },
  });

  if (!loaded) {
    throw new GalleryError("notFound");
  }

  return guestGalleryItems({
    event: loaded,
    customerDisabled: loaded.customer.disabled,
    customerAccessExpiresAt: loaded.customer.accessExpiresAt,
    cookieToken,
    now,
    storage,
  });
}

function customerClosed(event: { status: string }) {
  return event.status !== "ACTIVE";
}

async function requireCustomerEvent(actor: Actor, eventId: string) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...eventScope(actor),
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (!event) {
    await recordCrossCustomerEventAccess(actor, eventId);
    throw new GalleryError("notFound");
  }

  if (customerClosed(event)) {
    throw new GalleryError("unavailable");
  }

  return event;
}

export async function listCustomerGallery(
  actor: Actor,
  eventId: string,
  sort: "newest" | "oldest" = "newest",
  storage?: IStorageService,
): Promise<CustomerGalleryItem[]> {
  const event = await requireCustomerEvent(actor, eventId);
  const rows = await prisma.media.findMany({
    where: { eventId: event.id },
    select: mediaSelect,
    orderBy: { createdAt: sort === "oldest" ? "asc" : "desc" },
  });
  const files = storeOf(storage);
  const items: CustomerGalleryItem[] = [];

  for (const row of rows) {
    items.push(toCustomerGalleryItem(row, await presentRow(files, row)));
  }

  return items;
}

async function requireCustomerMedia(
  actor: Actor,
  eventId: string,
  mediaId: string,
) {
  const event = await requireCustomerEvent(actor, eventId);
  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      eventId: event.id,
    },
  });

  if (!media) {
    throw new GalleryError("notFound");
  }

  return media;
}

export async function mutateCustomerMedia(
  actor: Actor | null,
  eventId: string,
  mediaId: string,
  action: "hide" | "unhide" | "favorite" | "unfavorite" | "delete",
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const media = await requireCustomerMedia(actor, eventId, mediaId);

  if (action === "delete") {
    const files = storeOf(storage);
    await files.deleteObject(media.storageKey);

    if (media.thumbnailKey) {
      await files.deleteObject(media.thumbnailKey);
    }

    await prisma.media.delete({
      where: { id: media.id },
    });
    await recordApplicationLog({
      eventType: "media.deleted",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      targetType: "media",
      targetId: media.id,
      result: "success",
      metadata: { eventId: media.eventId },
    });

    return { ok: true as const };
  }

  await prisma.media.update({
    where: { id: media.id },
    data:
      action === "hide"
        ? { isHidden: true }
        : action === "unhide"
          ? { isHidden: false }
          : action === "favorite"
            ? { isFavorite: true }
            : { isFavorite: false },
  });

  if (action === "hide" || action === "unhide") {
    await recordApplicationLog({
      eventType: "media.visibility.changed",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      targetType: "media",
      targetId: media.id,
      result: "success",
      metadata: {
        eventId: media.eventId,
        visibility: action === "hide" ? "hidden" : "visible",
      },
    });
  }

  return { ok: true as const };
}

export async function deleteCustomerMediaSelection(
  actor: Actor | null,
  eventId: string,
  mediaIds: string[],
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const ids = [...new Set(mediaIds)];
  const rows = await prisma.media.findMany({
    where: {
      eventId: event.id,
      id: { in: ids },
    },
  });

  if (rows.length !== ids.length) {
    throw new GalleryError("notFound");
  }

  for (const media of rows) {
    await mutateCustomerMedia(actor, event.id, media.id, "delete", storage, now);
  }

  return { ok: true as const };
}

async function requireGuestMedia(
  code: string,
  mediaId: string,
  cookieToken: string | undefined,
  now: Date,
  options?: { download?: boolean },
) {
  const loaded = await prisma.event.findUnique({
    where: { uniqueCode: code },
    include: {
      customer: {
        select: { disabled: true, accessExpiresAt: true },
      },
    },
  });

  if (!loaded) {
    throw new GalleryError("notFound");
  }

  const decision = decideGuestAccess(
    {
      status: loaded.status,
      customerDisabled: loaded.customer.disabled,
      customerAccessExpiresAt: loaded.customer.accessExpiresAt,
    },
    now,
  );

  if (decision.state !== "ok") {
    throw new GalleryError(decision.state === "not_found" ? "notFound" : "unavailable");
  }

  if (options?.download && !loaded.guestDownloadsEnabled) {
    throw new GalleryError("unavailable");
  }

  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      eventId: loaded.id,
      isHidden: false,
      ...(loaded.privacyMode === "OWN_UPLOADS"
        ? {
            guestToken:
              cookieToken && isGuestToken(cookieToken) ? cookieToken : "missing",
          }
        : {}),
    },
  });

  if (!media) {
    throw new GalleryError("notFound");
  }

  return media;
}

async function downloadUrl(
  storage: IStorageService,
  media: { storageKey: string; originalFileName: string },
) {
  const url = await signedUrl(
    storage,
    media.storageKey,
    GALLERY_DOWNLOAD_SECONDS,
    sanitizeFileName(media.originalFileName),
  );

  if (!url) {
    throw new GalleryError("unavailable");
  }

  return { url };
}

export async function downloadGuestMedia(
  code: string,
  mediaId: string,
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const media = await requireGuestMedia(code, mediaId, cookieToken, now, { download: true });

  return downloadUrl(storeOf(storage), media);
}

export async function readGuestMediaFile(
  code: string,
  mediaId: string,
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const media = await requireGuestMedia(code, mediaId, cookieToken, now, { download: true });
  const files = storeOf(storage);
  const bytes = files.getObject ? await files.getObject(media.storageKey) : null;

  if (!bytes) {
    throw new GalleryError("unavailable");
  }

  return {
    bytes,
    mimeType: media.mimeType,
    fileName: media.originalFileName,
  };
}

export async function downloadCustomerMedia(
  actor: Actor | null,
  eventId: string,
  mediaId: string,
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const media = await requireCustomerMedia(actor, eventId, mediaId);

  return downloadUrl(storeOf(storage), media);
}

export async function readCustomerMediaFile(
  actor: Actor | null,
  eventId: string,
  mediaId: string,
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const media = await requireCustomerMedia(actor, eventId, mediaId);
  const files = storeOf(storage);
  const bytes = files.getObject ? await files.getObject(media.storageKey) : null;

  if (!bytes) {
    throw new GalleryError("unavailable");
  }

  return {
    bytes,
    mimeType: media.mimeType,
    fileName: media.originalFileName,
  };
}

async function openGuestEvent(code: string, now: Date) {
  const loaded = await prisma.event.findUnique({
    where: { uniqueCode: code },
    include: {
      customer: {
        select: { disabled: true, accessExpiresAt: true },
      },
    },
  });

  if (!loaded) {
    throw new GalleryError("notFound");
  }

  const decision = decideGuestAccess(
    {
      status: loaded.status,
      customerDisabled: loaded.customer.disabled,
      customerAccessExpiresAt: loaded.customer.accessExpiresAt,
    },
    now,
  );

  if (decision.state !== "ok") {
    throw new GalleryError(decision.state === "not_found" ? "notFound" : "unavailable");
  }

  return loaded;
}

function requireGuestOwnerToken(cookieToken: string | undefined) {
  if (!cookieToken || !isGuestToken(cookieToken)) {
    return null;
  }

  return cookieToken;
}

async function eraseGuestMedia(
  media: {
    id: string;
    eventId: string;
    storageKey: string;
    thumbnailKey: string | null;
  },
  storage: IStorageService,
) {
  await storage.deleteObject(media.storageKey);

  if (media.thumbnailKey) {
    await storage.deleteObject(media.thumbnailKey);
  }

  await prisma.media.delete({
    where: { id: media.id },
  });
  await recordApplicationLog({
    eventType: "media.deleted",
    actorType: "guest",
    targetType: "media",
    targetId: media.id,
    result: "success",
    metadata: { eventId: media.eventId },
  });
}

export async function deleteGuestMedia(
  code: string,
  mediaId: string,
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const token = requireGuestOwnerToken(cookieToken);

  if (!token) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  const event = await openGuestEvent(code, now);
  const media = await prisma.media.findFirst({
    where: {
      id: mediaId,
      eventId: event.id,
      guestToken: token,
    },
  });

  if (!media) {
    throw new GalleryError("notFound");
  }

  await eraseGuestMedia(media, storeOf(storage));

  return { ok: true as const };
}

export async function deleteGuestMediaSelection(
  code: string,
  mediaIds: string[],
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const token = requireGuestOwnerToken(cookieToken);

  if (!token) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  const event = await openGuestEvent(code, now);
  const ids = [...new Set(mediaIds)];
  const rows = await prisma.media.findMany({
    where: {
      eventId: event.id,
      guestToken: token,
      id: { in: ids },
    },
  });

  if (rows.length !== ids.length) {
    throw new GalleryError("notFound");
  }

  for (const media of rows) {
    await eraseGuestMedia(media, storeOf(storage));
  }

  return { deleted: rows.length };
}

export async function deleteGuestUploads(
  code: string,
  cookieToken: string | undefined,
  storage?: IStorageService,
  now = new Date(),
) {
  const token = requireGuestOwnerToken(cookieToken);

  if (!token) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  const event = await openGuestEvent(code, now);
  const rows = await prisma.media.findMany({
    where: {
      eventId: event.id,
      guestToken: token,
    },
  });

  for (const media of rows) {
    await eraseGuestMedia(media, storeOf(storage));
  }

  return { deleted: rows.length };
}

export async function countGuestUploads(
  code: string,
  cookieToken: string | undefined,
  now = new Date(),
) {
  const token = requireGuestOwnerToken(cookieToken);

  if (!token) {
    return 0;
  }

  const event = await openGuestEvent(code, now);

  return prisma.media.count({
    where: {
      eventId: event.id,
      guestToken: token,
    },
  });
}

export async function mediaTotals(eventIds: string[]) {
  const totals = new Map<
    string,
    { photos: number; videos: number; storageLabel: string }
  >();

  if (eventIds.length === 0) {
    return totals;
  }

  const grouped = await prisma.media.groupBy({
    by: ["eventId", "type"],
    where: {
      eventId: { in: eventIds },
    },
    _count: { _all: true },
    _sum: { size: true },
  });
  const bytes = new Map<string, bigint>();

  for (const row of grouped) {
    const current = totals.get(row.eventId) ?? {
      photos: 0,
      videos: 0,
      storageLabel: "0 MB",
    };
    const count = row._count._all;
    const added = row._sum.size ?? BigInt(0);

    if (mediaKind(row.type) === "video") {
      current.videos += count;
    } else {
      current.photos += count;
    }

    bytes.set(row.eventId, (bytes.get(row.eventId) ?? BigInt(0)) + added);
    totals.set(row.eventId, current);
  }

  for (const [eventId, total] of totals) {
    total.storageLabel = formatStorage(bytes.get(eventId) ?? BigInt(0));
  }

  return totals;
}

export async function listCustomerAlbums(actor: Actor, eventId: string) {
  const event = await requireCustomerEvent(actor, eventId);
  const albums = await prisma.album.findMany({
    where: { eventId: event.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return albums satisfies AlbumSummary[];
}

export async function createCustomerAlbum(
  actor: Actor | null,
  eventId: string,
  name: string,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const album = await prisma.album.create({
    data: {
      id: randomUUID(),
      eventId: event.id,
      name,
    },
    select: { id: true, name: true },
  });
  await recordApplicationLog({
    eventType: "album.created",
    actorType: actorTypeForRole(actor.role),
    actorId: actor.id,
    targetType: "album",
    targetId: album.id,
    result: "success",
    metadata: { eventId: event.id },
  });

  return album;
}

export async function renameCustomerAlbum(
  actor: Actor | null,
  eventId: string,
  albumId: string,
  name: string,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const existing = await prisma.album.findFirst({
    where: { id: albumId, eventId: event.id },
    select: { id: true },
  });

  if (!existing) {
    throw new GalleryError("notFound");
  }

  const renamed = await prisma.album.update({
    where: { id: existing.id },
    data: { name },
    select: { id: true, name: true },
  });
  await recordApplicationLog({
    eventType: "album.renamed",
    actorType: actorTypeForRole(actor.role),
    actorId: actor.id,
    targetType: "album",
    targetId: renamed.id,
    result: "success",
    metadata: { eventId: event.id },
  });

  return renamed;
}

export async function deleteCustomerAlbum(
  actor: Actor | null,
  eventId: string,
  albumId: string,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const existing = await prisma.album.findFirst({
    where: { id: albumId, eventId: event.id },
    select: { id: true },
  });

  if (!existing) {
    throw new GalleryError("notFound");
  }

  await prisma.album.delete({
    where: { id: existing.id },
  });
  await recordApplicationLog({
    eventType: "album.deleted",
    actorType: actorTypeForRole(actor.role),
    actorId: actor.id,
    targetType: "album",
    targetId: existing.id,
    result: "success",
    metadata: { eventId: event.id },
  });

  return { ok: true as const };
}

export async function assignCustomerMediaAlbum(
  actor: Actor | null,
  eventId: string,
  mediaId: string,
  albumId: string | null,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const media = await requireCustomerMedia(actor, eventId, mediaId);

  if (albumId) {
    const album = await prisma.album.findFirst({
      where: { id: albumId, eventId: media.eventId },
      select: { id: true },
    });

    if (!album) {
      throw new GalleryError("notFound");
    }
  }

  await prisma.media.update({
    where: { id: media.id },
    data: { albumId },
  });

  return { ok: true as const };
}

export async function assignCustomerMediaAlbums(
  actor: Actor | null,
  eventId: string,
  mediaIds: string[],
  albumId: string,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const ids = [...new Set(mediaIds)];
  const album = await prisma.album.findFirst({
    where: { id: albumId, eventId: event.id },
    select: { id: true },
  });

  if (!album) {
    throw new GalleryError("notFound");
  }

  const found = await prisma.media.findMany({
    where: { eventId: event.id, id: { in: ids } },
    select: { id: true },
  });

  if (found.length !== ids.length) {
    throw new GalleryError("notFound");
  }

  await prisma.media.updateMany({
    where: { id: { in: ids } },
    data: { albumId: album.id },
  });
  await recordApplicationLog({
    eventType: "media.bulk.assigned",
    actorType: actorTypeForRole(actor.role),
    actorId: actor.id,
    targetType: "event",
    targetId: event.id,
    result: "success",
    metadata: { eventId: event.id, count: ids.length },
  });

  return { ok: true as const, count: ids.length };
}

export async function prepareBulkDownload(
  actor: Actor | null,
  eventId: string,
  mediaIds: string[],
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      targetType: isInternalId(eventId) ? "event" : undefined,
      targetId: isInternalId(eventId) ? eventId : undefined,
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new GalleryError("unauthorized");
  }

  await ensureCustomerService(actor, now);
  const event = await requireCustomerEvent(actor, eventId);
  const ids = [...new Set(mediaIds)];
  const rows = await prisma.media.findMany({
    where: {
      eventId: event.id,
      id: { in: ids },
    },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = ids.map((id) => byId.get(id));

  if (ordered.some((row) => !row)) {
    throw new GalleryError("notFound");
  }

  const selected = ordered.filter((row) => row !== undefined);
  const total = selected.reduce((sum, row) => sum + row.size, BigInt(0));

  if (exceedsBulkCap(total)) {
    throw new GalleryError("oversize");
  }

  const names = uniqueZipNames(selected.map((row) => row.originalFileName));
  const files = storeOf(storage);
  const downloads = [];

  for (let index = 0; index < selected.length; index += 1) {
    const row = selected[index];
    const name = names[index];

    if (!row || !name) {
      throw new GalleryError("notFound");
    }

    const url = await signedUrl(files, row.storageKey, GALLERY_DOWNLOAD_SECONDS, name);

    if (!url) {
      throw new GalleryError("unavailable");
    }

    downloads.push({ name, url });
  }

  return { files: downloads };
}
