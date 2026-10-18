import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auth } from "@/lib/auth";
import { decideGuestAccess } from "@/lib/events/access";
import {
  DEFAULT_MAX_PHOTO_BYTES,
  DEFAULT_MAX_STORAGE_BYTES,
  DEFAULT_MAX_VIDEO_BYTES,
  PLATFORM_SETTINGS_ID,
} from "@/lib/events/defaults";
import { athensEndOfDay } from "@/lib/events/expiry";
import { EventError, type EventFormValues } from "@/lib/events/schema";
import { createCustomerEvent, loadGuestEvent } from "@/lib/events/service";
import { accessExpiryFromDays, grantCustomerService } from "@/lib/access";
import { activateCustomerAccess, setCustomerDisabled } from "@/lib/owner/service";
import { prisma } from "@/lib/prisma";
import { createBrandingIntent } from "@/lib/uploads/service";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `access-${randomUUID()}@example.com`;
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

  return prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, role: true, email: true },
  });
}

function form(name = "Access wedding"): EventFormValues {
  return {
    name,
    eventDate: "2027-06-01",
    welcomeMessageEl: "",
    welcomeMessageEn: "",
    uploadInstructionsEl: "",
    uploadInstructionsEn: "",
    backgroundColor: "#102030",
    panelStyle: "solid",
    accentColor: "#abcdef",
    titleFont: "noto-sans",
    guestFont: "noto-sans",
    logoSize: "medium",
    logoCorner: "square",
    privacyMode: "FULL_GALLERY",
    guestDownloadsEnabled: true,
    status: "ACTIVE",
  };
}

describe("customer service access", () => {
  beforeAll(async () => {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: {
        id: PLATFORM_SETTINGS_ID,
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
    await prisma.event.deleteMany({ where: { customerId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  });

  it("keeps a new customer unverified and pending, and blocks event creation", async () => {
    const customer = await signUpCustomer("Pending Couple");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });

    expect(stored.emailVerified).toBe(false);
    expect(stored.accessStatus).toBe("PENDING");
    await expect(createCustomerEvent(customer, form())).rejects.toBeInstanceOf(EventError);
    await expect(createCustomerEvent(customer, form())).rejects.toMatchObject({
      code: "inactive",
    });
  });

  it("blocks a verified pending customer and allows creation after owner activation", async () => {
    const owner = await signUpCustomer("Access Owner");
    await prisma.user.update({
      where: { id: owner.id },
      data: { role: "OWNER", emailVerified: true, accessStatus: "ACTIVE" },
    });
    const customer = await signUpCustomer("Verified Pending");
    await prisma.user.update({
      where: { id: customer.id },
      data: { emailVerified: true },
    });
    const now = new Date("2026-10-03T12:00:00.000Z");

    await expect(createCustomerEvent(customer, form(), now)).rejects.toMatchObject({
      code: "inactive",
    });

    const activated = await activateCustomerAccess(
      { id: owner.id, role: "OWNER" },
      customer.id,
      { duration: "30", expiresOn: "" },
      now,
    );

    expect(activated.accessExpiresAt.toISOString()).toBe("2026-11-02T12:00:00.000Z");
    const event = await createCustomerEvent(customer, form("Activated wedding"), now);
    expect(event.customerId).toBe(customer.id);

    const custom = await activateCustomerAccess(
      { id: owner.id, role: "OWNER" },
      customer.id,
      { duration: "custom", expiresOn: "2027-01-15" },
      now,
    );
    expect(custom.accessExpiresAt.toISOString()).toBe(athensEndOfDay("2027-01-15").toISOString());
    expect((await prisma.user.findUnique({ where: { id: customer.id } }))?.role).toBe("CUSTOMER");

    for (const days of [60, 90, 180, 365] as const) {
      await prisma.user.update({
        where: { id: customer.id },
        data: {
          disabled: true,
          accessStatus: "EXPIRED",
          accessExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        },
      });
      const renewed = await activateCustomerAccess(
        { id: owner.id, role: "OWNER" },
        customer.id,
        { duration: String(days) as "60" | "90" | "180" | "365", expiresOn: "" },
        now,
      );

      expect(renewed.accessExpiresAt.toISOString()).toBe(
        accessExpiryFromDays(days, now).toISOString(),
      );
    }
  });

  it("refuses an expired customer sign-in, event creation, and upload, and keeps the account", async () => {
    const customer = await signUpCustomer("Expired Couple");
    await grantCustomerService(customer.id, new Date("2099-01-01T00:00:00.000Z"));
    const event = await createCustomerEvent(customer, form("Before expiry"));
    await prisma.user.update({
      where: { id: customer.id },
      data: {
        emailVerified: true,
        accessStatus: "ACTIVE",
        accessExpiresAt: new Date("2026-10-01T00:00:00.000Z"),
        disabled: false,
      },
    });

    await expect(
      auth.api.signInEmail({
        body: { email: customer.email, password: "Password123!" },
      }),
    ).rejects.toThrow();
    await expect(
      createCustomerEvent(customer, form(), new Date("2026-10-03T12:00:00.000Z")),
    ).rejects.toMatchObject({ code: "inactive" });
    await expect(
      createBrandingIntent({
        actor: customer,
        eventId: event.id,
        slot: "cover",
        fileName: "cover.jpg",
        contentType: "image/jpeg",
        contentLength: BigInt(128),
        storage: {
          async presignPut() {
            return { url: "memory://put", headers: { "Content-Type": "image/jpeg" } };
          },
          async presignGet() {
            return "memory://get";
          },
          async headObject() {
            return null;
          },
          async deleteObject() {},
          async deletePrefix() {},
        },
      }),
    ).rejects.toMatchObject({ code: "inactive" });

    const stored = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(stored?.disabled).toBe(true);
    expect(stored?.accessStatus).toBe("EXPIRED");
    expect(stored?.email).toBe(customer.email);
    expect(await prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it("lets the owner renew expired access and blocks a disabled customer with a future date", async () => {
    const owner = await signUpCustomer("Renew Owner");
    await prisma.user.update({
      where: { id: owner.id },
      data: { role: "OWNER", emailVerified: true, accessStatus: "ACTIVE" },
    });
    const customer = await signUpCustomer("Renew Couple");
    await grantCustomerService(customer.id, new Date("2026-01-01T00:00:00.000Z"));
    await prisma.user.update({
      where: { id: customer.id },
      data: { accessStatus: "EXPIRED" },
    });
    const now = new Date("2026-10-03T12:00:00.000Z");
    await activateCustomerAccess(
      { id: owner.id, role: "OWNER" },
      customer.id,
      { duration: "60", expiresOn: "" },
      now,
    );
    const event = await createCustomerEvent(customer, form("Renewed wedding"), now);
    expect(event.name).toBe("Renewed wedding");

    const future = new Date("2027-10-03T12:00:00.000Z");
    await prisma.user.update({
      where: { id: customer.id },
      data: { accessStatus: "ACTIVE", accessExpiresAt: future, disabled: false, emailVerified: true },
    });
    await setCustomerDisabled({ id: owner.id, role: "OWNER" }, customer.id, true);
    await expect(createCustomerEvent(customer, form(), now)).rejects.toMatchObject({
      code: "inactive",
    });

    await setCustomerDisabled({ id: owner.id, role: "OWNER" }, customer.id, false);
    const restored = await createCustomerEvent(customer, form("Restored wedding"), now);
    expect(restored.customerId).toBe(customer.id);
  });

  it("closes the guest page when customer access expires, before cleanup runs", async () => {
    const customer = await signUpCustomer("Guest Closed");
    await grantCustomerService(customer.id);
    const event = await createCustomerEvent(customer, form("Closed guest"));
    await prisma.user.update({
      where: { id: customer.id },
      data: {
        accessStatus: "ACTIVE",
        disabled: false,
        accessExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        emailVerified: true,
      },
    });
    const loaded = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        loaded && {
          status: loaded.event.status,
          customerDisabled: loaded.customerDisabled,
          customerAccessExpiresAt: loaded.customerAccessExpiresAt,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");
    expect(await prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it("lets an owner create an event after their own access date has passed", async () => {
    const owner = await signUpCustomer("Unaffected Owner");
    await prisma.user.update({
      where: { id: owner.id },
      data: {
        role: "OWNER",
        emailVerified: false,
        accessStatus: "EXPIRED",
        accessExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    const customer = await signUpCustomer("Owner Event Customer");
    await grantCustomerService(customer.id);
    const event = await createCustomerEvent(
      { id: owner.id, role: "OWNER" },
      form("Owner still works"),
    );

    expect(event.customerId).toBe(owner.id);
    expect(customer.role).toBe("CUSTOMER");
  });
});
