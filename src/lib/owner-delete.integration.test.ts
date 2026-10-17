import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { auth } from "@/lib/auth";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { type EventFormValues } from "@/lib/events/schema";
import { removeOwnerCustomer, respondOwner } from "@/lib/owner/http";
import {
  createOwnerEvent,
  deleteCustomerPermanently,
  deleteOwnerEvent,
  setCustomerDisabled,
} from "@/lib/owner/service";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";
import { createGuestToken } from "@/lib/uploads/token";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `delete-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function cookieHeaderFrom(response: Response) {
  const cookies = response.headers.getSetCookie();
  return new Headers({
    cookie: cookies.map((item) => item.split(";")[0]).join("; "),
  });
}

async function signUpCustomer(name: string) {
  const email = emailAddress();
  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: "Password123!",
      preferredLocale: "en",
    },
  });

  return prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true, email: true, emailVerified: true, accessStatus: true },
  });
}

async function makeOwner(name: string) {
  const user = await signUpCustomer(name);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      role: "OWNER",
      emailVerified: true,
      accessStatus: "ACTIVE",
      accessExpiresAt: null,
      disabled: false,
    },
  });

  return { id: user.id, role: "OWNER", email: user.email };
}

function form(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    name: "Delete wedding",
    eventDate: "2027-09-01",
    welcomeMessageEl: "",
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
    guestDownloadsEnabled: true,
    retentionDays: 90,
    status: "ACTIVE",
    ...overrides,
  };
}

class RecordingStorage implements IStorageService {
  readonly prefixes: string[] = [];
  failOnCall: number | null = null;

  async presignPut() {
    return { url: "memory://put", headers: { "Content-Type": "image/jpeg" } };
  }

  async presignGet() {
    return "memory://get";
  }

  async headObject() {
    return null;
  }

  async deleteObject() {}

  async deletePrefix(prefix: string) {
    this.prefixes.push(prefix);

    if (this.failOnCall !== null && this.prefixes.length === this.failOnCall) {
      throw new Error("storage failed");
    }
  }
}

function createEvent(
  owner: { id: string; role: string },
  customerId: string,
  name: string,
) {
  return createOwnerEvent(owner, { ...form({ name }), customerId });
}

describe("owner customer deletion", () => {
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
    await prisma.verification.deleteMany({
      where: { value: { in: ids } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: ids } },
    });
    await prisma.$disconnect();
  });

  it("rejects an unauthenticated caller and a customer", async () => {
    const customer = await signUpCustomer("Blocked Customer");
    const owner = await makeOwner("Delete Guard");

    const anonymous = await respondOwner(() =>
      removeOwnerCustomer(null, customer.id, { confirmEmail: customer.email }),
    );
    expect(anonymous.status).toBe(401);

    const forbidden = await respondOwner(() =>
      removeOwnerCustomer(customer, customer.id, { confirmEmail: customer.email }),
    );
    expect(forbidden.status).toBe(403);

    const stillThere = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(stillThere?.id).toBe(customer.id);
    expect(owner.role).toBe("OWNER");
  });

  it("lets an owner delete a customer through the owner endpoint", async () => {
    const owner = await makeOwner("Http Owner");
    const customer = await signUpCustomer("Http Customer");

    const response = await respondOwner(() =>
      removeOwnerCustomer(owner, customer.id, { confirmEmail: customer.email }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toBeNull();
  });

  it("does not delete an owner account, including the caller's own", async () => {
    const owner = await makeOwner("Self Owner");
    const other = await makeOwner("Other Owner");
    const storage = new RecordingStorage();

    await expect(
      deleteCustomerPermanently(owner, owner.id, owner.email, storage),
    ).rejects.toMatchObject({ code: "forbidden" });
    await expect(
      deleteCustomerPermanently(owner, other.id, other.email, storage),
    ).rejects.toMatchObject({ code: "forbidden" });

    expect(storage.prefixes).toEqual([]);
    await expect(prisma.user.findUnique({ where: { id: owner.id } })).resolves.toMatchObject({
      role: "OWNER",
    });
    await expect(prisma.user.findUnique({ where: { id: other.id } })).resolves.toMatchObject({
      role: "OWNER",
    });
  });

  it("deletes the customer, their events, media, albums, uploads, sessions, and storage prefixes", async () => {
    const owner = await makeOwner("Deleting Owner");
    const customer = await signUpCustomer("Delete Me");
    const other = await signUpCustomer("Keep Me");
    const signedIn = await auth.api.signInEmail({
      body: { email: customer.email, password: "Password123!" },
      asResponse: true,
    });
    const sessionHeaders = cookieHeaderFrom(signedIn);
    expect(await getActiveSession(sessionHeaders)).not.toBeNull();

    const first = await createEvent(owner, customer.id, "First wedding");
    const second = await createEvent(owner, customer.id, "Second wedding");
    const kept = await createEvent(owner, other.id, "Kept wedding");
    const album = await prisma.album.create({
      data: { id: randomUUID(), eventId: first.id, name: "Ceremony" },
    });
    const media = await prisma.media.create({
      data: {
        id: randomUUID(),
        eventId: first.id,
        albumId: album.id,
        storageKey: `events/${first.id}/originals/${randomUUID()}`,
        thumbnailKey: `events/${first.id}/thumbnails/${randomUUID()}`,
        type: "PHOTO",
        originalFileName: "one.jpg",
        size: BigInt(1000),
        mimeType: "image/jpeg",
        guestToken: createGuestToken(),
      },
    });
    const secondMedia = await prisma.media.create({
      data: {
        id: randomUUID(),
        eventId: second.id,
        storageKey: `events/${second.id}/originals/${randomUUID()}`,
        type: "VIDEO",
        originalFileName: "two.mp4",
        size: BigInt(2000),
        mimeType: "video/mp4",
        guestToken: createGuestToken(),
      },
    });
    const intent = await prisma.uploadIntent.create({
      data: {
        id: randomUUID(),
        eventId: second.id,
        storageKey: `events/${second.id}/originals/${randomUUID()}`,
        kind: "original",
        originalFileName: "pending.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(10),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const keptMedia = await prisma.media.create({
      data: {
        id: randomUUID(),
        eventId: kept.id,
        storageKey: `events/${kept.id}/originals/${randomUUID()}`,
        type: "PHOTO",
        originalFileName: "kept.jpg",
        size: BigInt(1000),
        mimeType: "image/jpeg",
        guestToken: createGuestToken(),
      },
    });
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: `reset-password:${randomUUID()}`,
        value: customer.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.verification.create({
      data: {
        id: randomUUID(),
        identifier: `reset-password:${randomUUID()}`,
        value: other.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await prisma.rateLimitHit.create({
      data: {
        id: randomUUID(),
        bucket: `branding:${customer.id}:${first.id}`,
        windowStart: new Date(),
        count: 1,
      },
    });

    const storage = new RecordingStorage();
    await deleteCustomerPermanently(owner, customer.id, customer.email.toUpperCase(), storage);

    expect(storage.prefixes.sort()).toEqual(
      [eventStoragePrefix(first.id), eventStoragePrefix(second.id)].sort(),
    );
    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toBeNull();
    await expect(prisma.event.count({ where: { id: { in: [first.id, second.id] } } })).resolves.toBe(0);
    await expect(prisma.media.count({ where: { id: { in: [media.id, secondMedia.id] } } })).resolves.toBe(0);
    await expect(prisma.album.count({ where: { id: album.id } })).resolves.toBe(0);
    await expect(prisma.uploadIntent.count({ where: { id: intent.id } })).resolves.toBe(0);
    await expect(prisma.session.count({ where: { userId: customer.id } })).resolves.toBe(0);
    await expect(prisma.account.count({ where: { userId: customer.id } })).resolves.toBe(0);
    await expect(prisma.verification.count({ where: { value: customer.id } })).resolves.toBe(0);
    await expect(
      prisma.rateLimitHit.count({ where: { bucket: `branding:${customer.id}:${first.id}` } }),
    ).resolves.toBe(0);
    expect(await getActiveSession(sessionHeaders)).toBeNull();

    await expect(prisma.user.findUnique({ where: { id: other.id } })).resolves.toMatchObject({
      role: "CUSTOMER",
    });
    await expect(prisma.event.findUnique({ where: { id: kept.id } })).resolves.toMatchObject({
      customerId: other.id,
    });
    await expect(prisma.media.findUnique({ where: { id: keptMedia.id } })).resolves.toMatchObject({
      eventId: kept.id,
    });
    await expect(prisma.verification.count({ where: { value: other.id } })).resolves.toBe(1);
    await expect(
      prisma.platformSettings.findUnique({ where: { id: PLATFORM_SETTINGS_ID } }),
    ).resolves.not.toBeNull();
    await expect(prisma.user.findUnique({ where: { id: owner.id } })).resolves.toMatchObject({
      role: "OWNER",
    });
  });

  it("keeps the customer when storage deletion fails or the confirmation email does not match", async () => {
    const owner = await makeOwner("Storage Owner");
    const customer = await signUpCustomer("Storage Customer");
    const first = await createEvent(owner, customer.id, "Storage one");
    const second = await createEvent(owner, customer.id, "Storage two");
    const storage = new RecordingStorage();
    storage.failOnCall = 2;

    await expect(
      deleteCustomerPermanently(owner, customer.id, "wrong@example.com", storage),
    ).rejects.toMatchObject({ code: "confirmEmail" });
    expect(storage.prefixes).toEqual([]);

    await expect(
      deleteCustomerPermanently(owner, customer.id, customer.email, storage),
    ).rejects.toMatchObject({ code: "storage" });

    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toMatchObject({
      email: customer.email,
    });
    await expect(prisma.event.count({ where: { id: { in: [first.id, second.id] } } })).resolves.toBe(2);
  });

  it("deletes a customer with no media and customers who are pending, expired, or disabled", async () => {
    const owner = await makeOwner("Status Owner");
    const pending = await signUpCustomer("Pending Customer");
    const expired = await signUpCustomer("Expired Customer");
    const disabled = await signUpCustomer("Disabled Customer");
    expect(pending.emailVerified).toBe(false);
    expect(pending.accessStatus).toBe("PENDING");

    const emptyEvent = await createEvent(owner, pending.id, "Empty wedding");
    const expiredEvent = await createEvent(owner, expired.id, "Expired wedding");
    const disabledEvent = await createEvent(owner, disabled.id, "Disabled wedding");
    await prisma.user.update({
      where: { id: expired.id },
      data: { accessStatus: "EXPIRED", accessExpiresAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    await setCustomerDisabled(owner, disabled.id, true);

    const storage = new RecordingStorage();
    await deleteCustomerPermanently(owner, pending.id, pending.email, storage);
    await deleteCustomerPermanently(owner, expired.id, expired.email, storage);
    await deleteCustomerPermanently(owner, disabled.id, disabled.email, storage);

    expect(storage.prefixes.sort()).toEqual(
      [
        eventStoragePrefix(emptyEvent.id),
        eventStoragePrefix(expiredEvent.id),
        eventStoragePrefix(disabledEvent.id),
      ].sort(),
    );
    await expect(
      prisma.user.count({ where: { id: { in: [pending.id, expired.id, disabled.id] } } }),
    ).resolves.toBe(0);
    await expect(
      prisma.event.count({
        where: { id: { in: [emptyEvent.id, expiredEvent.id, disabledEvent.id] } },
      }),
    ).resolves.toBe(0);
  });

  it("removes the deleted customer's log identifiers and guest rate-limit buckets", async () => {
    const owner = await makeOwner("Erasure Owner");
    const customer = await signUpCustomer("Erasure Customer");
    const other = await signUpCustomer("Erasure Other");
    const event = await createEvent(owner, customer.id, "Erasure wedding");
    const kept = await createEvent(owner, other.id, "Erasure kept");
    const stored = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
      select: { uniqueCode: true },
    });
    const keptEvent = await prisma.event.findUniqueOrThrow({
      where: { id: kept.id },
      select: { uniqueCode: true },
    });
    const album = await prisma.album.create({
      data: { id: randomUUID(), eventId: event.id, name: "Ceremony" },
    });
    const media = await prisma.media.create({
      data: {
        id: randomUUID(),
        eventId: event.id,
        albumId: album.id,
        storageKey: `events/${event.id}/originals/${randomUUID()}`,
        type: "PHOTO",
        originalFileName: "one.jpg",
        size: BigInt(1000),
        mimeType: "image/jpeg",
        guestToken: createGuestToken(),
      },
    });
    const operationalId = randomUUID();
    const passwordId = randomUUID();
    const rateId = randomUUID();
    const accessId = randomUUID();
    const settingsId = randomUUID();
    const failedLoginId = randomUUID();
    const otherLoginId = randomUUID();
    const guestBucket = `guest:203.0.113.8:${stored.uniqueCode}`;
    const otherGuestBucket = `guest:203.0.113.9:${keptEvent.uniqueCode}`;
    const similarBucket = `guest:203.0.113.10:${stored.uniqueCode}extra`;

    await prisma.applicationLog.createMany({
      data: [
        {
          id: operationalId,
          eventType: "account.updated",
          actorType: "customer",
          actorId: customer.id,
          targetType: "user",
          targetId: customer.id,
          result: "success",
          metadata: { fields: ["name"] },
        },
        {
          id: passwordId,
          eventType: "auth.password.reset",
          actorType: "customer",
          actorId: customer.id,
          targetType: "user",
          targetId: customer.id,
          result: "success",
          metadata: {},
        },
        {
          id: rateId,
          eventType: "rate.limited",
          actorType: "guest",
          targetType: "event",
          targetId: event.id,
          result: "denied",
          metadata: { reason: "upload", uploadPurpose: "guest", eventId: event.id },
        },
        {
          id: accessId,
          eventType: "access.denied",
          actorType: "customer",
          actorId: other.id,
          targetType: "event",
          targetId: event.id,
          result: "denied",
          metadata: { reason: "forbidden" },
        },
        {
          id: settingsId,
          eventType: "settings.updated",
          actorType: "owner",
          actorId: owner.id,
          targetType: "settings",
          targetId: "default",
          result: "success",
          metadata: { maxEventsPerCustomer: 10 },
        },
        {
          id: failedLoginId,
          eventType: "auth.login.failed",
          actorType: "anonymous",
          result: "failure",
          metadata: { reason: "invalid_credentials" },
        },
        {
          id: otherLoginId,
          eventType: "auth.login.succeeded",
          actorType: "customer",
          actorId: other.id,
          targetType: "user",
          targetId: other.id,
          result: "success",
          metadata: {},
        },
      ],
    });
    await prisma.rateLimitHit.createMany({
      data: [
        { id: randomUUID(), bucket: guestBucket, windowStart: new Date(), count: 1 },
        { id: randomUUID(), bucket: otherGuestBucket, windowStart: new Date(), count: 1 },
        { id: randomUUID(), bucket: similarBucket, windowStart: new Date(), count: 1 },
      ],
    });

    await deleteCustomerPermanently(owner, customer.id, customer.email, new RecordingStorage());

    await expect(prisma.applicationLog.findUnique({ where: { id: operationalId } })).resolves.toBeNull();
    await expect(prisma.applicationLog.findUnique({ where: { id: passwordId } })).resolves.toMatchObject({
      eventType: "auth.password.reset",
      actorId: null,
      targetType: null,
      targetId: null,
      result: "success",
    });
    await expect(prisma.applicationLog.findUnique({ where: { id: rateId } })).resolves.toMatchObject({
      eventType: "rate.limited",
      actorId: null,
      targetType: null,
      targetId: null,
      result: "denied",
      metadata: { reason: "upload", uploadPurpose: "guest" },
    });
    await expect(prisma.applicationLog.findUnique({ where: { id: accessId } })).resolves.toMatchObject({
      actorId: other.id,
      targetType: null,
      targetId: null,
      metadata: { reason: "forbidden" },
    });
    await expect(prisma.applicationLog.findUnique({ where: { id: settingsId } })).resolves.toMatchObject({
      actorId: owner.id,
      targetType: "settings",
      targetId: "default",
      metadata: { maxEventsPerCustomer: 10 },
    });
    await expect(prisma.applicationLog.findUnique({ where: { id: failedLoginId } })).resolves.toMatchObject({
      eventType: "auth.login.failed",
      actorId: null,
      targetId: null,
      metadata: { reason: "invalid_credentials" },
    });
    await expect(prisma.applicationLog.findUnique({ where: { id: otherLoginId } })).resolves.toMatchObject({
      actorId: other.id,
      targetId: other.id,
    });

    const deletion = await prisma.applicationLog.findFirst({
      where: { eventType: "account.deleted", actorId: owner.id },
      orderBy: { createdAt: "desc" },
    });
    expect(deletion?.targetId).toBeNull();
    expect(deletion?.metadata).toEqual({ count: 1 });
    expect(JSON.stringify(deletion)).not.toContain(customer.id);
    expect(JSON.stringify(deletion)).not.toContain(event.id);
    expect(JSON.stringify(deletion)).not.toContain(media.id);
    expect(JSON.stringify(deletion)).not.toContain(album.id);
    expect(JSON.stringify(deletion)).not.toContain(stored.uniqueCode);

    await expect(
      prisma.applicationLog.count({
        where: {
          OR: [
            { actorId: customer.id },
            { targetId: customer.id },
            { targetId: { in: [event.id, media.id, album.id] } },
            { metadata: { path: ["eventId"], equals: event.id } },
          ],
        },
      }),
    ).resolves.toBe(0);
    await expect(prisma.rateLimitHit.count({ where: { bucket: guestBucket } })).resolves.toBe(0);
    await expect(prisma.rateLimitHit.count({ where: { bucket: otherGuestBucket } })).resolves.toBe(1);
    await expect(prisma.rateLimitHit.count({ where: { bucket: similarBucket } })).resolves.toBe(1);

    await prisma.applicationLog.deleteMany({
      where: { id: { in: [passwordId, rateId, accessId, settingsId, failedLoginId, otherLoginId, deletion!.id] } },
    });
    await prisma.rateLimitHit.deleteMany({
      where: { bucket: { in: [otherGuestBucket, similarBucket] } },
    });
  });

  it("still deletes the account when log erasure fails and does not record the customer id", async () => {
    const owner = await makeOwner("Log Failure Owner");
    const customer = await signUpCustomer("Log Failure Customer");
    const operationalId = randomUUID();
    await prisma.applicationLog.create({
      data: {
        id: operationalId,
        eventType: "auth.login.succeeded",
        actorType: "customer",
        actorId: customer.id,
        targetType: "user",
        targetId: customer.id,
        result: "success",
        metadata: {},
      },
    });
    const transaction = prisma.$transaction.bind(prisma) as (...args: never[]) => Promise<unknown>;
    let calls = 0;
    const spy = vi.spyOn(prisma, "$transaction").mockImplementation(((...args: never[]) => {
      calls += 1;

      if (calls > 1) {
        return Promise.reject(new Error("log erasure failed"));
      }

      return transaction(...args);
    }) as typeof prisma.$transaction);

    try {
      await deleteCustomerPermanently(owner, customer.id, customer.email, new RecordingStorage());
    } finally {
      spy.mockRestore();
    }

    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toBeNull();
    await expect(prisma.applicationLog.findUnique({ where: { id: operationalId } })).resolves.toMatchObject({
      actorId: customer.id,
      targetId: customer.id,
    });
    const deletion = await prisma.applicationLog.findFirst({
      where: { eventType: "account.deleted", actorId: owner.id },
      orderBy: { createdAt: "desc" },
    });
    expect(deletion?.targetId).toBeNull();
    expect(JSON.stringify(deletion)).not.toContain(customer.id);
    await prisma.applicationLog.deleteMany({
      where: { id: { in: [operationalId, deletion!.id] } },
    });
  });

  it("rolls back account deletion when rate-limit cleanup fails", async () => {
    const owner = await makeOwner("Rate Failure Owner");
    const customer = await signUpCustomer("Rate Failure Customer");
    const unrelated = `guest:203.0.113.40:${randomUUID().replaceAll("-", "").slice(0, 16)}`;
    const branded = `branding:${customer.id}:${randomUUID()}`;
    await prisma.rateLimitHit.createMany({
      data: [
        { id: randomUUID(), bucket: unrelated, windowStart: new Date(), count: 1 },
        { id: randomUUID(), bucket: branded, windowStart: new Date(), count: 1 },
      ],
    });
    const spy = vi.spyOn(prisma.rateLimitHit, "deleteMany").mockRejectedValue(new Error("rate limit failed"));

    try {
      await expect(
        deleteCustomerPermanently(owner, customer.id, customer.email, new RecordingStorage()),
      ).rejects.toThrow();
    } finally {
      spy.mockRestore();
    }

    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toMatchObject({
      id: customer.id,
    });
    await expect(prisma.rateLimitHit.count({ where: { bucket: unrelated } })).resolves.toBe(1);
    await expect(prisma.rateLimitHit.count({ where: { bucket: branded } })).resolves.toBe(1);
    await prisma.rateLimitHit.deleteMany({
      where: { bucket: { in: [unrelated, branded] } },
    });
  });

  it("still deletes a single event without deleting the customer", async () => {
    const owner = await makeOwner("Event Owner");
    const customer = await signUpCustomer("Event Customer");
    const event = await createEvent(owner, customer.id, "One event");
    const storage = new RecordingStorage();

    await deleteOwnerEvent(owner, event.id, storage);

    expect(storage.prefixes).toEqual([eventStoragePrefix(event.id)]);
    await expect(prisma.event.findUnique({ where: { id: event.id } })).resolves.toBeNull();
    await expect(prisma.user.findUnique({ where: { id: customer.id } })).resolves.toMatchObject({
      role: "CUSTOMER",
    });
  });
});
