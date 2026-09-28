import { randomUUID } from "node:crypto";
import { decideGuestAccess, eventScope } from "@/lib/events/access";
import { GalleryError } from "@/lib/gallery/errors";
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

type GalleryEvent = {
  id: string;
  privacyMode: string;
  status: string;
  expiresAt: Date;
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
    cookieToken: string | undefined;
    now?: Date;
    storage?: IStorageService;
  },
): Promise<GalleryItem[]> {
  const now = input.now ?? new Date();
  const decision = decideGuestAccess(
    {
      status: input.event.status,
      expiresAt: input.event.expiresAt,
      customerDisabled: input.customerDisabled,
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
    select: mediaSelect,
    orderBy: { createdAt: "desc" },
  });
  const storage = storeOf(input.storage);
  const items: GalleryItem[] = [];

  for (const row of rows) {
    items.push(toGalleryItem(row, await presentRow(storage, row)));
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
        select: { disabled: true },
      },
    },
  });

  if (!loaded) {
    throw new GalleryError("notFound");
  }

  return guestGalleryItems({
    event: loaded,
    customerDisabled: loaded.customer.disabled,
    cookieToken,
    now,
    storage,
  });
}

function customerClosed(event: { status: string; expiresAt: Date }, now: Date) {
  return event.status === "EXPIRED" || event.expiresAt.getTime() <= now.getTime();
}

async function requireCustomerEvent(actor: Actor, eventId: string, now: Date) {
  const event = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...eventScope(actor),
    },
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  });

  if (!event) {
    throw new GalleryError("notFound");
  }

  if (customerClosed(event, now)) {
    throw new GalleryError("unavailable");
  }

  return event;
}

export async function listCustomerGallery(
  actor: Actor,
  eventId: string,
  sort: "newest" | "oldest" = "newest",
  storage?: IStorageService,
  now = new Date(),
): Promise<CustomerGalleryItem[]> {
  const event = await requireCustomerEvent(actor, eventId, now);
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
  now: Date,
) {
  const event = await requireCustomerEvent(actor, eventId, now);
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
    throw new GalleryError("unauthorized");
  }

  const media = await requireCustomerMedia(actor, eventId, mediaId, now);

  if (action === "delete") {
    const files = storeOf(storage);
    await files.deleteObject(media.storageKey);

    if (media.thumbnailKey) {
      await files.deleteObject(media.thumbnailKey);
    }

    await prisma.media.delete({
      where: { id: media.id },
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

  return { ok: true as const };
}

async function requireGuestMedia(
  code: string,
  mediaId: string,
  cookieToken: string | undefined,
  now: Date,
) {
  const loaded = await prisma.event.findUnique({
    where: { uniqueCode: code },
    include: {
      customer: {
        select: { disabled: true },
      },
    },
  });

  if (!loaded) {
    throw new GalleryError("notFound");
  }

  const decision = decideGuestAccess(
    {
      status: loaded.status,
      expiresAt: loaded.expiresAt,
      customerDisabled: loaded.customer.disabled,
    },
    now,
  );

  if (decision.state !== "ok") {
    throw new GalleryError(decision.state === "not_found" ? "notFound" : "unavailable");
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
  const media = await requireGuestMedia(code, mediaId, cookieToken, now);

  return downloadUrl(storeOf(storage), media);
}

export async function downloadCustomerMedia(
  actor: Actor | null,
  eventId: string,
  mediaId: string,
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    throw new GalleryError("unauthorized");
  }

  const media = await requireCustomerMedia(actor, eventId, mediaId, now);

  return downloadUrl(storeOf(storage), media);
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

export async function listCustomerAlbums(actor: Actor, eventId: string, now = new Date()) {
  const event = await requireCustomerEvent(actor, eventId, now);
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
    throw new GalleryError("unauthorized");
  }

  const event = await requireCustomerEvent(actor, eventId, now);
  const album = await prisma.album.create({
    data: {
      id: randomUUID(),
      eventId: event.id,
      name,
    },
    select: { id: true, name: true },
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
    throw new GalleryError("unauthorized");
  }

  const event = await requireCustomerEvent(actor, eventId, now);
  const existing = await prisma.album.findFirst({
    where: { id: albumId, eventId: event.id },
    select: { id: true },
  });

  if (!existing) {
    throw new GalleryError("notFound");
  }

  return prisma.album.update({
    where: { id: existing.id },
    data: { name },
    select: { id: true, name: true },
  });
}

export async function deleteCustomerAlbum(
  actor: Actor | null,
  eventId: string,
  albumId: string,
  now = new Date(),
) {
  if (!actor) {
    throw new GalleryError("unauthorized");
  }

  const event = await requireCustomerEvent(actor, eventId, now);
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
    throw new GalleryError("unauthorized");
  }

  const media = await requireCustomerMedia(actor, eventId, mediaId, now);

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

export async function prepareBulkDownload(
  actor: Actor | null,
  eventId: string,
  mediaIds: string[],
  storage?: IStorageService,
  now = new Date(),
) {
  if (!actor) {
    throw new GalleryError("unauthorized");
  }

  const event = await requireCustomerEvent(actor, eventId, now);
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
