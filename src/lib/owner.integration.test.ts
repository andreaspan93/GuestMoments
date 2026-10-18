import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { grantCustomerService } from "@/lib/access";
import { auth } from "@/lib/auth";
import { decideGuestAccess } from "@/lib/events/access";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { eventFormSchema, type EventFormValues } from "@/lib/events/schema";
import { updateCustomerEvent } from "@/lib/events/service";
import { GalleryError } from "@/lib/gallery/errors";
import { listGuestGallery } from "@/lib/gallery/service";
import { bytesToMib, mibToBytes } from "@/lib/owner/bytes";
import {
  postOwnerEvent,
  readOwnerCounts,
  readOwnerCustomers,
  readOwnerEvents,
  readOwnerSettings,
  respondOwner,
} from "@/lib/owner/http";
import { ownerCreateSchema, ownerUpdateSchema } from "@/lib/owner/schema";
import {
  createOwnerEvent,
  setCustomerDisabled,
  updateOwnerEvent,
  updateOwnerSettings,
} from "@/lib/owner/service";
import { prisma } from "@/lib/prisma";
import type { IStorageService } from "@/lib/storage/types";
import { getActiveSession } from "@/lib/session";
import { UploadError } from "@/lib/uploads/errors";
import { createGuestUploadIntent } from "@/lib/uploads/service";
import { createGuestToken } from "@/lib/uploads/token";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase7-${randomUUID()}@example.com`;
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
    select: { id: true, role: true, email: true },
  });
  await grantCustomerService(user.id);
  return user;
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
    name: "Owner wedding",
    eventDate: "2027-09-01",
    welcomeMessageEl: "Καλώς ήρθατε",
    welcomeMessageEn: "",
    uploadInstructionsEl: "",
    uploadInstructionsEn: "",
    backgroundColor: "#f7f1ea",
    panelStyle: "solid",
    accentColor: "#8c3d32",
    titleFont: "noto-sans",
    guestFont: "noto-sans",
    welcomeFont: "noto-sans",
    titleBold: true,
    guestBold: false,
    welcomeBold: false,
    logoSize: "medium",
    logoCorner: "square",
    privacyMode: "FULL_GALLERY",
    guestDownloadsEnabled: true,
    status: "ACTIVE",
    ...overrides,
  };
}

class MemoryStorage implements IStorageService {
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

  async deletePrefix() {}
}

async function restoreSettings() {
  await prisma.platformSettings.update({
    where: { id: PLATFORM_SETTINGS_ID },
    data: {
      defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
      maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
      maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
    },
  });
}

describe("owner administration", () => {
  beforeAll(restoreSettings);

  afterAll(async () => {
    await restoreSettings();
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

  it("returns 403 when a customer calls owner routes", async () => {
    const customer = await signUpCustomer("Blocked Customer");
    const reads = [
      () => readOwnerCustomers(customer),
      () => readOwnerEvents(customer),
      () => readOwnerSettings(customer),
      () => readOwnerCounts(customer),
    ];

    for (const read of reads) {
      const response = await respondOwner(read);
      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({ error: "forbidden" });
    }
  });

  it("rejects owner create without a customer and keeps retention off the customer form", async () => {
    const owner = await makeOwner("Create Owner");
    const customer = await signUpCustomer("Assigned Customer");
    const other = await signUpCustomer("Other Customer");
    await restoreSettings();

    expect(ownerCreateSchema.safeParse(form()).success).toBe(false);
    const missing = await respondOwner(() => postOwnerEvent(owner, form()));
    expect(missing.status).toBe(400);

    await expect(
      createOwnerEvent(owner, { ...form(), customerId: "" }),
    ).rejects.toMatchObject({ code: "invalid" });
    await expect(
      createOwnerEvent(owner, { ...form(), customerId: randomUUID() }),
    ).rejects.toMatchObject({ code: "notFound" });

    const created = await createOwnerEvent(owner, {
      ...form(),
      customerId: customer.id,
    });

    expect(created.customerId).toBe(customer.id);
    expect(created.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);

    expect(
      eventFormSchema.safeParse({
        ...form(),
        retentionDays: 30,
      }).success,
    ).toBe(false);

    const quota = mibToBytes(2048);
    const extended = await updateOwnerEvent(owner, created.id, {
      ...form({ name: "Extended wedding" }),
      customerId: customer.id,
      quotaMib: 2048,
    });

    expect(extended.maxStorageBytes).toBe(quota);

    const renamed = await updateCustomerEvent(
      customer,
      created.id,
      form({ name: "Couple rename", guestDownloadsEnabled: false }),
    );

    expect(renamed.name).toBe("Couple rename");
    expect(renamed.maxStorageBytes).toBe(quota);
    expect(renamed.customerId).toBe(customer.id);

    const reassigned = await updateOwnerEvent(owner, created.id, {
      ...form({ name: "Couple rename" }),
      customerId: other.id,
      quotaMib: 2048,
    });

    expect(reassigned.customerId).toBe(other.id);
    expect(reassigned.guestDownloadsEnabled).toBe(false);
    expect(ownerUpdateSchema.safeParse(form()).success).toBe(false);
  });

  it("changes the platform default without moving an existing event", async () => {
    const owner = await makeOwner("Settings Owner");
    const customer = await signUpCustomer("Settings Customer");
    const untouchedCustomer = await signUpCustomer("Untouched Customer");
    await restoreSettings();
    const event = await createOwnerEvent(owner, {
      ...form({ name: "Held wedding" }),
      customerId: customer.id,
    });
    const other = await createOwnerEvent(owner, {
      ...form({ name: "Other wedding" }),
      customerId: untouchedCustomer.id,
    });
    await updateOwnerSettings(owner, {
      defaultQuotaMib: 2048,
      maxPhotoMib: bytesToMib(DEFAULT_MAX_PHOTO_BYTES),
      maxVideoMib: bytesToMib(DEFAULT_MAX_VIDEO_BYTES),
      maxEventsPerCustomer: 10,
    });

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    const storedOther = await prisma.event.findUniqueOrThrow({ where: { id: other.id } });

    expect(stored.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
    expect(storedOther.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);

    const extended = await updateOwnerEvent(owner, event.id, {
      ...form({ name: "Held wedding" }),
      customerId: customer.id,
      quotaMib: bytesToMib(DEFAULT_MAX_STORAGE_BYTES),
    });

    const after = await prisma.event.findUniqueOrThrow({ where: { id: other.id } });

    expect(extended.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
    expect(after.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
    expect(after.customerId).toBe(untouchedCustomer.id);
  });

  it("disables a customer, then restores guest access", async () => {
    const owner = await makeOwner("Access Owner");
    const customer = await signUpCustomer("Access Customer");
    await restoreSettings();
    const event = await createOwnerEvent(owner, {
      ...form({ name: "Gated wedding" }),
      customerId: customer.id,
    });
    const signedIn = await auth.api.signInEmail({
      body: { email: customer.email, password: "Password123!" },
      asResponse: true,
    });
    const headers = new Headers({
      cookie: signedIn.headers
        .getSetCookie()
        .map((item) => item.split(";")[0])
        .join("; "),
    });
    const storage = new MemoryStorage();
    const token = createGuestToken();

    await setCustomerDisabled(owner, customer.id, true);

    await expect(getActiveSession(headers)).resolves.toBeNull();
    await expect(
      prisma.session.count({ where: { userId: customer.id } }),
    ).resolves.toBe(0);
    await expect(
      auth.api.signInEmail({
        body: { email: customer.email, password: "Password123!" },
      }),
    ).rejects.toThrow();
    await expect(listGuestGallery(event.uniqueCode, token)).rejects.toBeInstanceOf(
      GalleryError,
    );
    await expect(
      createGuestUploadIntent({
        code: event.uniqueCode,
        cookieToken: token,
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(128),
        kind: "original",
        storage,
        ip: "203.0.113.7",
      }),
    ).rejects.toMatchObject({ code: "unavailable" } satisfies Partial<UploadError>);

    const loaded = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
      include: { customer: { select: { disabled: true, accessExpiresAt: true } } },
    });

    expect(
      decideGuestAccess(
        {
          status: loaded.status,
          customerDisabled: loaded.customer.disabled,
          customerAccessExpiresAt: loaded.customer.accessExpiresAt,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");

    await setCustomerDisabled(owner, customer.id, false);

    await expect(listGuestGallery(event.uniqueCode, token)).resolves.toEqual([]);
    await expect(
      createGuestUploadIntent({
        code: event.uniqueCode,
        cookieToken: token,
        fileName: "photo.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(128),
        kind: "original",
        storage,
        ip: "203.0.113.8",
      }),
    ).resolves.toMatchObject({ url: "memory://put" });
    await expect(
      auth.api.signInEmail({
        body: { email: customer.email, password: "Password123!" },
      }),
    ).resolves.toBeTruthy();
  });
});
