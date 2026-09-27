import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { createCustomerEvent, deleteCustomerEvent } from "@/lib/events/service";
import type { EventFormValues } from "@/lib/events/schema";
import { prisma } from "@/lib/prisma";
import { runStorageCleanup } from "@/lib/storage/cleanup";
import type { IStorageService } from "@/lib/storage/types";
import { createGuestToken } from "@/lib/uploads/token";
import {
  completeGuestUpload,
  createBrandingIntent,
  createGuestUploadIntent,
} from "@/lib/uploads/service";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase4-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

async function signUpCustomer(name: string) {
  const email = emailAddress();
  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: "password123",
      preferredLocale: "el",
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });
}

function form(): EventFormValues {
  return {
    name: "Upload wedding",
    eventDate: "2027-08-01",
    welcomeMessageEl: "Καλώς ήρθατε",
    welcomeMessageEn: "",
    uploadInstructionsEl: "",
    uploadInstructionsEn: "",
    backgroundColor: "#f7f1ea",
    accentColor: "#8c3d32",
    privacyMode: "FULL_GALLERY",
    status: "ACTIVE",
  };
}

class MemoryStorage implements IStorageService {
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string }>();

  async presignPut(input: {
    key: string;
    contentType: string;
    contentLength: number;
    expiresInSeconds: number;
  }) {
    return {
      url: `memory://${input.key}`,
      headers: { "Content-Type": input.contentType },
    };
  }

  async presignGet() {
    return "memory://get";
  }

  async headObject(key: string) {
    const object = this.objects.get(key);

    if (!object) {
      return null;
    }

    return {
      contentLength: object.bytes.byteLength,
      contentType: object.contentType,
    };
  }

  async deleteObject(key: string) {
    this.objects.delete(key);
  }

  async deletePrefix(prefix: string) {
    for (const key of this.objects.keys()) {
      if (key.startsWith(prefix)) {
        this.objects.delete(key);
      }
    }
  }

  put(url: string, contentType: string, size: number) {
    const key = url.slice("memory://".length);
    this.objects.set(key, { bytes: new Uint8Array(size), contentType });
    return key;
  }
}

describe("uploads", () => {
  beforeAll(async () => {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: {
        id: PLATFORM_SETTINGS_ID,
        defaultRetentionDays: 90,
        maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
        maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
        defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
      },
      update: {
        maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
        maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
      },
    });
  });

  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);

    await prisma.event.deleteMany({
      where: { customerId: { in: ids } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
  });

  it("rejects another key, an oversize file, and a disallowed type", async () => {
    const customer = await signUpCustomer("Upload A");
    const event = await createCustomerEvent(customer, form());
    const storage = new MemoryStorage();
    const token = createGuestToken();
    const created = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(12),
      kind: "original",
      storage,
      ip: `phase4-key-${event.id}`,
    });

    storage.put(created.url, "image/jpeg", 12);
    await expect(
      completeGuestUpload({
        code: event.uniqueCode,
        intentId: created.intentId,
        cookieToken: token,
        claimedKey: `events/${event.id}/originals/${randomUUID()}`,
        guestName: "",
        guestMessage: "",
        storage,
      }),
    ).rejects.toMatchObject({ code: "intent" });
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(0);

    await expect(
      createGuestUploadIntent({
        code: event.uniqueCode,
        cookieToken: token,
        fileName: "huge.jpg",
        contentType: "image/jpeg",
        contentLength: DEFAULT_MAX_PHOTO_BYTES + BigInt(1),
        kind: "original",
        storage,
        ip: `phase4-size-${event.id}`,
      }),
    ).rejects.toMatchObject({ code: "oversize" });

    await expect(
      createGuestUploadIntent({
        code: event.uniqueCode,
        cookieToken: token,
        fileName: "clip.gif",
        contentType: "image/gif",
        contentLength: BigInt(12),
        kind: "original",
        storage,
        ip: `phase4-type-${event.id}`,
      }),
    ).rejects.toMatchObject({ code: "type" });
  });

  it("blocks a presign that would pass the event quota", async () => {
    const customer = await signUpCustomer("Upload Quota");
    const event = await createCustomerEvent(customer, form());
    await prisma.event.update({
      where: { id: event.id },
      data: { maxStorageBytes: BigInt(20) },
    });
    const storage = new MemoryStorage();
    const token = createGuestToken();
    const first = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "one.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(12),
      kind: "original",
      storage,
      ip: `phase4-quota-${event.id}`,
    });

    storage.put(first.url, "image/jpeg", 12);
    await completeGuestUpload({
      code: event.uniqueCode,
      intentId: first.intentId,
      cookieToken: token,
      guestName: "Niki",
      guestMessage: "Hello",
      storage,
    });

    await expect(
      createGuestUploadIntent({
        code: event.uniqueCode,
        cookieToken: token,
        fileName: "two.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(12),
        kind: "original",
        storage,
        ip: `phase4-quota-b-${event.id}`,
      }),
    ).rejects.toMatchObject({ code: "quota" });
  });

  it("saves the original when the thumbnail object is missing", async () => {
    const customer = await signUpCustomer("Upload Thumb");
    const event = await createCustomerEvent(customer, form());
    const storage = new MemoryStorage();
    const token = createGuestToken();
    const original = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(16),
      kind: "original",
      storage,
      ip: `phase4-thumb-${event.id}`,
    });
    const thumbnail = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "thumbnail.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(8),
      kind: "thumbnail",
      storage,
      ip: `phase4-thumb-b-${event.id}`,
    });

    storage.put(original.url, "image/jpeg", 16);
    const completed = await completeGuestUpload({
      code: event.uniqueCode,
      intentId: original.intentId,
      cookieToken: token,
      guestName: "",
      guestMessage: "",
      thumbnailIntentId: thumbnail.intentId,
      storage,
    });
    const media = await prisma.media.findUniqueOrThrow({
      where: { id: completed.mediaId },
    });

    expect(completed).toEqual({ mediaId: media.id });
    expect(media.thumbnailKey).toBeNull();
    expect(media.storageKey.startsWith(`events/${event.id}/originals/`)).toBe(true);
    expect(media.guestToken).toBe(token);
  });

  it("refuses a branding upload without the owning customer", async () => {
    const owner = await signUpCustomer("Upload Owner");
    const other = await signUpCustomer("Upload Other");
    const event = await createCustomerEvent(owner, form());
    const storage = new MemoryStorage();

    await expect(
      createBrandingIntent({
        actor: null,
        eventId: event.id,
        slot: "cover",
        fileName: "cover.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(10),
        storage,
      }),
    ).rejects.toMatchObject({ code: "unauthorized" });

    await expect(
      createBrandingIntent({
        actor: other,
        eventId: event.id,
        slot: "cover",
        fileName: "cover.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(10),
        storage,
      }),
    ).rejects.toMatchObject({ code: "notFound" });
  });

  it("deletes abandoned intents and the event prefix", async () => {
    const customer = await signUpCustomer("Upload Cleanup");
    const event = await createCustomerEvent(customer, form());
    const storage = new MemoryStorage();
    const token = createGuestToken();
    const created = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "photo.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(4),
      kind: "original",
      storage,
      ip: `phase4-clean-${event.id}`,
    });
    const key = storage.put(created.url, "image/jpeg", 4);

    await prisma.uploadIntent.update({
      where: { id: created.intentId },
      data: { expiresAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    await runStorageCleanup(storage, new Date());

    expect(storage.objects.has(key)).toBe(false);
    expect(await prisma.uploadIntent.findUnique({ where: { id: created.intentId } })).toBeNull();

    const kept = await createGuestUploadIntent({
      code: event.uniqueCode,
      cookieToken: token,
      fileName: "keep.jpg",
      contentType: "image/jpeg",
      contentLength: BigInt(4),
      kind: "original",
      storage,
      ip: `phase4-keep-${event.id}`,
    });
    storage.put(kept.url, "image/jpeg", 4);
    await deleteCustomerEvent(customer, event.id, storage);

    expect(storage.objects.size).toBe(0);
    expect(await prisma.event.findUnique({ where: { id: event.id } })).toBeNull();
  });
});
