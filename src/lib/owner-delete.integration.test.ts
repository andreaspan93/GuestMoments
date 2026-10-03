import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
      password: "password123",
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
    privacyMode: "FULL_GALLERY",
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
      body: { email: customer.email, password: "password123" },
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
