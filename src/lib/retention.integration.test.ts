import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/retention/route";
import { grantCustomerService } from "@/lib/access";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { createCustomerEvent } from "@/lib/events/service";
import type { EventFormValues } from "@/lib/events/schema";
import { listGuestGallery } from "@/lib/gallery/service";
import { prisma } from "@/lib/prisma";
import { runStorageCleanup } from "@/lib/storage/cleanup";
import type { IStorageService } from "@/lib/storage/types";
import { createGuestToken } from "@/lib/uploads/token";
import { completeGuestUpload, createGuestUploadIntent } from "@/lib/uploads/service";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase8-${randomUUID()}@example.com`;
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

  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true },
  });
  await grantCustomerService(user.id);
  return user;
}

function form(name: string): EventFormValues {
  return {
    name,
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

async function storePhoto(
  storage: MemoryStorage,
  code: string,
  label: string,
) {
  const token = createGuestToken();
  const created = await createGuestUploadIntent({
    code,
    cookieToken: token,
    fileName: "photo.jpg",
    contentType: "image/jpeg",
    contentLength: BigInt(8),
    kind: "original",
    storage,
    ip: `phase8-${label}-${randomUUID()}`,
  });
  const key = storage.put(created.url, "image/jpeg", 8);
  await completeGuestUpload({
    code,
    intentId: created.intentId,
    cookieToken: token,
    guestName: "",
    guestMessage: "",
    storage,
  });

  return key;
}

describe("retention purge", () => {
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
      update: {},
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

  it("closes the guest gallery before the purge, then keeps the event", async () => {
    const customer = await signUpCustomer("Retention");
    const storage = new MemoryStorage();
    const event = await createCustomerEvent(customer, form("Retention wedding"));
    const kept = await createCustomerEvent(customer, form("Still open"));
    const photoKey = await storePhoto(storage, event.uniqueCode, "due");
    const keptKey = await storePhoto(storage, kept.uniqueCode, "kept");
    const coverKey = `events/${event.id}/branding/cover-${randomUUID()}`;
    storage.objects.set(coverKey, {
      bytes: new Uint8Array(4),
      contentType: "image/jpeg",
    });
    const past = new Date("2020-01-01T00:00:00.000Z");

    await prisma.event.update({
      where: { id: event.id },
      data: { expiresAt: past, coverKey },
    });

    await expect(
      listGuestGallery(event.uniqueCode, createGuestToken(), storage),
    ).rejects.toMatchObject({ code: "unavailable" });
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(1);
    expect(storage.objects.has(photoKey)).toBe(true);

    const first = await runStorageCleanup(storage, new Date());
    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(first.purgedEvents).toBeGreaterThanOrEqual(1);
    expect(storage.objects.has(photoKey)).toBe(false);
    expect(storage.objects.has(coverKey)).toBe(false);
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(0);
    expect(stored.status).toBe("EXPIRED");
    expect(stored.storagePurgedAt).not.toBeNull();
    expect(stored.coverKey).toBeNull();
    expect(stored.name).toBe("Retention wedding");
    expect(storage.objects.has(keptKey)).toBe(true);
    expect(await prisma.media.count({ where: { eventId: kept.id } })).toBe(1);

    const markedAt = stored.storagePurgedAt?.toISOString();
    const second = await runStorageCleanup(storage, new Date());
    const again = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(second.purgedEvents).toBe(0);
    expect(again.storagePurgedAt?.toISOString()).toBe(markedAt);
    expect(again.status).toBe("EXPIRED");
    expect(storage.objects.has(keptKey)).toBe(true);
    expect(await prisma.media.count({ where: { eventId: kept.id } })).toBe(1);
  });

  it("purges a disabled event after it expires", async () => {
    const customer = await signUpCustomer("Disabled retention");
    const storage = new MemoryStorage();
    const event = await createCustomerEvent(customer, form("Disabled wedding"));
    const photoKey = await storePhoto(storage, event.uniqueCode, "disabled");

    await prisma.event.update({
      where: { id: event.id },
      data: { expiresAt: new Date("2020-06-01T00:00:00.000Z"), status: "DISABLED" },
    });
    await runStorageCleanup(storage, new Date());

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });

    expect(storage.objects.has(photoKey)).toBe(false);
    expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(0);
    expect(stored.status).toBe("EXPIRED");
    expect(stored.storagePurgedAt).not.toBeNull();
  });

  it("does nothing when the cron secret is missing or wrong", async () => {
    const customer = await signUpCustomer("Cron secret");
    const storage = new MemoryStorage();
    const event = await createCustomerEvent(customer, form("Secret wedding"));
    const photoKey = await storePhoto(storage, event.uniqueCode, "secret");

    await prisma.event.update({
      where: { id: event.id },
      data: { expiresAt: new Date("2020-03-01T00:00:00.000Z") },
    });

    const previous = process.env.CRON_SECRET;

    try {
      delete process.env.CRON_SECRET;
      const missing = await GET(new Request("http://localhost/api/cron/retention"));
      process.env.CRON_SECRET = "phase8-cron-secret";
      const wrong = await GET(
        new Request("http://localhost/api/cron/retention", {
          headers: { authorization: "Bearer other-secret" },
        }),
      );

      expect(missing.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(storage.objects.has(photoKey)).toBe(true);
      expect(await prisma.media.count({ where: { eventId: event.id } })).toBe(1);
      expect(
        (await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).storagePurgedAt,
      ).toBeNull();
    } finally {
      if (previous === undefined) {
        delete process.env.CRON_SECRET;
      } else {
        process.env.CRON_SECRET = previous;
      }
    }
  });
});
