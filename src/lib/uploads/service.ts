import { randomUUID } from "node:crypto";
import { decideGuestAccess, eventScope } from "@/lib/events/access";
import { PLATFORM_SETTINGS_ID } from "@/lib/events/defaults";
import { loadGuestEvent } from "@/lib/events/service";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { UploadError } from "@/lib/uploads/errors";
import {
  brandingObjectKey,
  classifyUpload,
  exceedsUploadCap,
  keysMatch,
  originalObjectKey,
  sanitizeFileName,
  thumbnailObjectKey,
} from "@/lib/uploads/policy";
import { consumeUploadRateLimit } from "@/lib/uploads/rate-limit";

const INTENT_TTL_MS = 15 * 60 * 1000;
const PRESIGN_SECONDS = 15 * 60;

type Actor = {
  id: string;
  role: string;
};

type BrandingSlot = "cover" | "logo" | "background";

async function uploadCaps() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!settings) {
    throw new UploadError("storage");
  }

  return {
    photo: settings.maxPhotoBytes,
    video: settings.maxVideoBytes,
  };
}

async function reservedBytes(eventId: string, now: Date) {
  const [media, pending] = await Promise.all([
    prisma.media.aggregate({
      where: { eventId },
      _sum: { size: true },
    }),
    prisma.uploadIntent.aggregate({
      where: {
        eventId,
        kind: "original",
        consumedAt: null,
        expiresAt: { gt: now },
      },
      _sum: { contentLength: true },
    }),
  ]);

  return (media._sum.size ?? BigInt(0)) + (pending._sum.contentLength ?? BigInt(0));
}

async function requireOpenEvent(code: string, now: Date) {
  const loaded = await loadGuestEvent(code);
  const decision = decideGuestAccess(
    loaded
      ? {
          status: loaded.event.status,
          expiresAt: loaded.event.expiresAt,
          customerDisabled: loaded.customerDisabled,
        }
      : null,
    now,
  );

  if (decision.state === "not_found" || !loaded) {
    throw new UploadError("notFound");
  }

  if (decision.state === "unavailable") {
    throw new UploadError("unavailable");
  }

  return loaded.event;
}

function objectMatches(
  head: { contentLength: number; contentType: string | null },
  expectedType: string,
  expectedLength: bigint,
) {
  if (head.contentLength !== Number(expectedLength)) {
    return false;
  }

  if (head.contentType && head.contentType.split(";")[0]?.trim() !== expectedType) {
    return false;
  }

  return true;
}

async function presignIntent(input: {
  eventId: string;
  storageKey: string;
  kind: "original" | "thumbnail" | "branding";
  brandingSlot?: BrandingSlot;
  contentType: string;
  contentLength: bigint;
  guestToken: string | null;
  fileName: string;
  storage: IStorageService;
  now: Date;
}) {
  const intent = await prisma.uploadIntent.create({
    data: {
      id: randomUUID(),
      eventId: input.eventId,
      storageKey: input.storageKey,
      kind: input.kind,
      brandingSlot: input.brandingSlot,
      originalFileName: input.fileName,
      contentType: input.contentType,
      contentLength: input.contentLength,
      guestToken: input.guestToken,
      expiresAt: new Date(input.now.getTime() + INTENT_TTL_MS),
    },
  });
  const presigned = await input.storage.presignPut({
    key: input.storageKey,
    contentType: input.contentType,
    contentLength: Number(input.contentLength),
    expiresInSeconds: PRESIGN_SECONDS,
  });

  return {
    intentId: intent.id,
    url: presigned.url,
    headers: presigned.headers,
  };
}

export async function createGuestUploadIntent(input: {
  code: string;
  cookieToken: string | null;
  fileName: string;
  contentType: string;
  contentLength: bigint;
  kind: "original" | "thumbnail";
  storage: IStorageService;
  ip: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  await consumeUploadRateLimit(`guest:${input.ip}:${input.code}`, now);

  if (!input.cookieToken) {
    throw new UploadError("unauthorized");
  }

  const event = await requireOpenEvent(input.code, now);
  const fileName = sanitizeFileName(input.fileName);
  const classified = classifyUpload(input.contentType, fileName);

  if (!classified || (input.kind === "thumbnail" && classified !== "photo")) {
    throw new UploadError("type");
  }

  const caps = await uploadCaps();

  if (exceedsUploadCap(classified, input.contentLength, caps)) {
    throw new UploadError("oversize");
  }

  if (input.kind === "original") {
    const reserved = await reservedBytes(event.id, now);

    if (reserved + input.contentLength > event.maxStorageBytes) {
      throw new UploadError("quota");
    }
  }

  return presignIntent({
    eventId: event.id,
    storageKey:
      input.kind === "original"
        ? originalObjectKey(event.id)
        : thumbnailObjectKey(event.id),
    kind: input.kind,
    contentType: input.contentType,
    contentLength: input.contentLength,
    guestToken: input.cookieToken,
    fileName,
    storage: input.storage,
    now,
  });
}

export async function completeGuestUpload(input: {
  code: string;
  intentId: string;
  cookieToken: string | null;
  claimedKey?: string;
  guestName: string;
  guestMessage: string;
  thumbnailIntentId?: string;
  storage: IStorageService;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const event = await requireOpenEvent(input.code, now);
  const guestToken = input.cookieToken;

  if (!guestToken) {
    throw new UploadError("unauthorized");
  }

  const intent = await prisma.uploadIntent.findFirst({
    where: {
      id: input.intentId,
      eventId: event.id,
      kind: "original",
    },
  });

  if (
    !intent ||
    intent.consumedAt ||
    intent.expiresAt <= now ||
    intent.guestToken !== guestToken ||
    !keysMatch(intent.storageKey, input.claimedKey)
  ) {
    throw new UploadError("intent");
  }

  const head = await input.storage.headObject(intent.storageKey);

  if (!head || !objectMatches(head, intent.contentType, intent.contentLength)) {
    throw new UploadError("intent");
  }

  let thumbnailKey: string | null = null;
  let thumbnailIntentId: string | null = null;

  if (input.thumbnailIntentId) {
    const thumbnail = await prisma.uploadIntent.findFirst({
      where: {
        id: input.thumbnailIntentId,
        eventId: event.id,
        kind: "thumbnail",
        guestToken,
        consumedAt: null,
        expiresAt: { gt: now },
      },
    });

    if (thumbnail) {
      const thumbnailHead = await input.storage.headObject(thumbnail.storageKey);

      if (
        thumbnailHead &&
        objectMatches(thumbnailHead, thumbnail.contentType, thumbnail.contentLength)
      ) {
        thumbnailKey = thumbnail.storageKey;
        thumbnailIntentId = thumbnail.id;
      }
    }
  }

  const media = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM "event" WHERE id = ${event.id} FOR UPDATE`;
    const used = await tx.media.aggregate({
      where: { eventId: event.id },
      _sum: { size: true },
    });
    const current = used._sum.size ?? BigInt(0);

    if (current + intent.contentLength > event.maxStorageBytes) {
      throw new UploadError("quota");
    }

    const created = await tx.media.create({
      data: {
        id: randomUUID(),
        eventId: event.id,
        storageKey: intent.storageKey,
        thumbnailKey,
        type: intent.contentType.startsWith("video/") ? "VIDEO" : "PHOTO",
        originalFileName: intent.originalFileName,
        size: intent.contentLength,
        mimeType: intent.contentType,
        guestToken,
        guestName: input.guestName.trim().slice(0, 80),
        guestMessage: input.guestMessage.trim().slice(0, 500),
      },
    });

    await tx.uploadIntent.update({
      where: { id: intent.id },
      data: { consumedAt: now },
    });

    if (thumbnailIntentId) {
      await tx.uploadIntent.update({
        where: { id: thumbnailIntentId },
        data: { consumedAt: now },
      });
    }

    return created;
  });

  return { mediaId: media.id };
}

export async function createBrandingIntent(input: {
  actor: Actor | null;
  eventId: string;
  slot: BrandingSlot;
  fileName: string;
  contentType: string;
  contentLength: bigint;
  storage: IStorageService;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (!input.actor) {
    throw new UploadError("unauthorized");
  }

  await consumeUploadRateLimit(`branding:${input.actor.id}:${input.eventId}`, now);

  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      ...eventScope(input.actor),
    },
    select: { id: true },
  });

  if (!event) {
    throw new UploadError("notFound");
  }

  const fileName = sanitizeFileName(input.fileName);
  const classified = classifyUpload(input.contentType, fileName);

  if (classified !== "photo") {
    throw new UploadError("type");
  }

  const caps = await uploadCaps();

  if (exceedsUploadCap("photo", input.contentLength, caps)) {
    throw new UploadError("oversize");
  }

  return presignIntent({
    eventId: event.id,
    storageKey: brandingObjectKey(event.id, input.slot),
    kind: "branding",
    brandingSlot: input.slot,
    contentType: input.contentType,
    contentLength: input.contentLength,
    guestToken: null,
    fileName,
    storage: input.storage,
    now,
  });
}

export async function completeBrandingUpload(input: {
  actor: Actor | null;
  eventId: string;
  intentId: string;
  claimedKey?: string;
  storage: IStorageService;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  if (!input.actor) {
    throw new UploadError("unauthorized");
  }

  const event = await prisma.event.findFirst({
    where: {
      id: input.eventId,
      ...eventScope(input.actor),
    },
  });

  if (!event) {
    throw new UploadError("notFound");
  }

  const intent = await prisma.uploadIntent.findFirst({
    where: {
      id: input.intentId,
      eventId: event.id,
      kind: "branding",
    },
  });

  if (
    !intent ||
    intent.consumedAt ||
    intent.expiresAt <= now ||
    !intent.brandingSlot ||
    !keysMatch(intent.storageKey, input.claimedKey)
  ) {
    throw new UploadError("intent");
  }

  const head = await input.storage.headObject(intent.storageKey);

  if (!head || !objectMatches(head, intent.contentType, intent.contentLength)) {
    throw new UploadError("intent");
  }

  const slot = intent.brandingSlot;
  const previous =
    slot === "cover"
      ? event.coverKey
      : slot === "logo"
        ? event.logoKey
        : event.backgroundImageKey;

  await prisma.$transaction([
    prisma.event.update({
      where: { id: event.id },
      data:
        slot === "cover"
          ? { coverKey: intent.storageKey }
          : slot === "logo"
            ? { logoKey: intent.storageKey }
            : { backgroundImageKey: intent.storageKey },
    }),
    prisma.uploadIntent.update({
      where: { id: intent.id },
      data: { consumedAt: now },
    }),
  ]);

  if (previous && previous !== intent.storageKey) {
    await input.storage.deleteObject(previous);
  }

  return { storageKey: intent.storageKey };
}
