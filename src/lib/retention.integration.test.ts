import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/cron/retention/route";
import { grantCustomerService } from "@/lib/access";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { createCustomerEvent, deleteCustomerEvent } from "@/lib/events/service";
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
      password: "Password123!",
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
    titleFont: "noto-sans",
    guestFont: "noto-sans",
    logoSize: "medium",
    logoCorner: "square",
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

  it("removes expired sessions and verification rows and keeps current ones", async () => {
    const customer = await signUpCustomer("Retention identity");
    const now = new Date();
    const expiredSession = randomUUID();
    const currentSession = randomUUID();
    const expiredVerification = randomUUID();
    const currentVerification = randomUUID();

    await prisma.session.createMany({
      data: [
        {
          id: expiredSession,
          token: randomUUID(),
          userId: customer.id,
          expiresAt: new Date(now.getTime() - 60_000),
        },
        {
          id: currentSession,
          token: randomUUID(),
          userId: customer.id,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      ],
    });
    await prisma.verification.createMany({
      data: [
        {
          id: expiredVerification,
          identifier: `reset-password:${randomUUID()}`,
          value: customer.id,
          expiresAt: new Date(now.getTime() - 60_000),
        },
        {
          id: currentVerification,
          identifier: `reset-password:${randomUUID()}`,
          value: customer.id,
          expiresAt: new Date(now.getTime() + 60 * 60 * 1000),
        },
      ],
    });

    try {
      const result = await runStorageCleanup(new MemoryStorage(), now);

      expect(result.expiredSessions).toBeGreaterThanOrEqual(1);
      expect(result.expiredVerifications).toBeGreaterThanOrEqual(1);
      await expect(prisma.session.findUnique({ where: { id: expiredSession } })).resolves.toBeNull();
      await expect(prisma.session.findUnique({ where: { id: currentSession } })).resolves.toMatchObject({
        userId: customer.id,
      });
      await expect(
        prisma.verification.findUnique({ where: { id: expiredVerification } }),
      ).resolves.toBeNull();
      await expect(
        prisma.verification.findUnique({ where: { id: currentVerification } }),
      ).resolves.toMatchObject({ value: customer.id });
    } finally {
      await prisma.session.deleteMany({ where: { id: { in: [expiredSession, currentSession] } } });
      await prisma.verification.deleteMany({
        where: { id: { in: [expiredVerification, currentVerification] } },
      });
    }
  });

  it("deletes postgres rate-limit rows older than 24 hours even when Upstash is configured", async () => {
    const now = new Date();
    const oldId = randomUUID();
    const freshId = randomUUID();
    const oldCode = randomUUID().replaceAll("-", "").slice(0, 16);
    const freshCode = randomUUID().replaceAll("-", "").slice(0, 16);

    await prisma.rateLimitHit.createMany({
      data: [
        {
          id: oldId,
          bucket: `guest:203.0.113.8:${oldCode}`,
          windowStart: new Date(now.getTime() - 25 * 60 * 60 * 1000),
          count: 1,
        },
        {
          id: freshId,
          bucket: `guest:203.0.113.9:${freshCode}`,
          windowStart: new Date(now.getTime() - 60 * 60 * 1000),
          count: 1,
        },
      ],
    });
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");

    try {
      const result = await runStorageCleanup(new MemoryStorage(), now);

      expect(result.expiredRateLimits).toBeGreaterThanOrEqual(1);
      await expect(prisma.rateLimitHit.findUnique({ where: { id: oldId } })).resolves.toBeNull();
      await expect(prisma.rateLimitHit.findUnique({ where: { id: freshId } })).resolves.toMatchObject({
        count: 1,
      });
    } finally {
      vi.unstubAllEnvs();
      await prisma.rateLimitHit.deleteMany({ where: { id: { in: [oldId, freshId] } } });
    }
  });

  it("removes only the deleted event's rate-limit records", async () => {
    const customer = await signUpCustomer("Rate event");
    const removed = await createCustomerEvent(customer, form("Removed wedding"));
    const kept = await createCustomerEvent(customer, form("Kept wedding"));
    const removedGuest = `guest:203.0.113.20:${removed.uniqueCode}`;
    const keptGuest = `guest:203.0.113.21:${kept.uniqueCode}`;
    const similar = `guest:203.0.113.22:${removed.uniqueCode}extra`;
    const removedBranding = `branding:${customer.id}:${removed.id}`;
    const keptBranding = `branding:${customer.id}:${kept.id}`;
    const now = new Date();

    await prisma.rateLimitHit.createMany({
      data: [removedGuest, keptGuest, similar, removedBranding, keptBranding].map((bucket) => ({
        id: randomUUID(),
        bucket,
        windowStart: now,
        count: 1,
      })),
    });

    await deleteCustomerEvent(customer, removed.id, new MemoryStorage());

    await expect(prisma.rateLimitHit.count({ where: { bucket: removedGuest } })).resolves.toBe(0);
    await expect(prisma.rateLimitHit.count({ where: { bucket: removedBranding } })).resolves.toBe(0);
    await expect(prisma.rateLimitHit.count({ where: { bucket: keptGuest } })).resolves.toBe(1);
    await expect(prisma.rateLimitHit.count({ where: { bucket: keptBranding } })).resolves.toBe(1);
    await expect(prisma.rateLimitHit.count({ where: { bucket: similar } })).resolves.toBe(1);
    await expect(prisma.event.findUnique({ where: { id: removed.id } })).resolves.toBeNull();
    await expect(prisma.event.findUnique({ where: { id: kept.id } })).resolves.toMatchObject({
      id: kept.id,
    });

    await prisma.rateLimitHit.deleteMany({
      where: { bucket: { in: [keptGuest, keptBranding, similar] } },
    });
  });

  it("deletes the event when postgres rate-limit cleanup fails after storage is removed", async () => {
    const customer = await signUpCustomer("Rate failure event");
    const event = await createCustomerEvent(customer, form("Rate failure wedding"));
    const storage = new MemoryStorage();
    const key = `events/${event.id}/photo.jpg`;
    storage.objects.set(key, { bytes: new Uint8Array(4), contentType: "image/jpeg" });
    const bucket = `guest:203.0.113.30:${event.uniqueCode}`;

    await prisma.rateLimitHit.create({
      data: {
        id: randomUUID(),
        bucket,
        windowStart: new Date(),
        count: 1,
      },
    });
    const spy = vi
      .spyOn(prisma.rateLimitHit, "deleteMany")
      .mockRejectedValueOnce(new Error("rate limit failed"));

    try {
      try {
        await expect(deleteCustomerEvent(customer, event.id, storage)).resolves.toBeUndefined();
      } finally {
        spy.mockRestore();
      }

      await expect(prisma.event.findUnique({ where: { id: event.id } })).resolves.toBeNull();
      expect(storage.objects.has(key)).toBe(false);
      await expect(prisma.rateLimitHit.count({ where: { bucket } })).resolves.toBe(1);
      const deleted = await prisma.applicationLog.findFirst({
        where: { eventType: "event.deleted", targetId: event.id },
        orderBy: { createdAt: "desc" },
      });
      expect(deleted?.result).toBe("success");
    } finally {
      await prisma.rateLimitHit.deleteMany({ where: { bucket } });
    }
  });

  it("reports a failure when expired-session cleanup fails", async () => {
    const spy = vi
      .spyOn(prisma.session, "deleteMany")
      .mockRejectedValueOnce(new Error("session cleanup failed"));

    try {
      await expect(runStorageCleanup(new MemoryStorage(), new Date())).rejects.toThrow(
        "session cleanup failed",
      );
    } finally {
      spy.mockRestore();
    }
  });
});
