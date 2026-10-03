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
import { grantCustomerService } from "@/lib/access";
import { activateCustomerAccess, setCustomerDisabled } from "@/lib/owner/service";
import { prisma } from "@/lib/prisma";
import { getActiveSession } from "@/lib/session";

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
      password: "password123",
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
    accentColor: "#abcdef",
    privacyMode: "FULL_GALLERY",
    status: "ACTIVE",
  };
}

function cookieHeaderFrom(response: Response) {
  return new Headers({
    cookie: response.headers.getSetCookie().map((item) => item.split(";")[0]).join("; "),
  });
}

describe("customer service access", () => {
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
  });

  it("lets an expired customer log in but not create an event, and keeps the account", async () => {
    const customer = await signUpCustomer("Expired Couple");
    const expiry = new Date("2026-10-01T00:00:00.000Z");
    await prisma.user.update({
      where: { id: customer.id },
      data: {
        emailVerified: true,
        accessStatus: "ACTIVE",
        accessExpiresAt: expiry,
        disabled: false,
      },
    });
    const signedIn = await auth.api.signInEmail({
      body: { email: customer.email, password: "password123" },
      asResponse: true,
    });
    expect(signedIn.status).toBe(200);
    const session = await getActiveSession(cookieHeaderFrom(signedIn));
    expect(session?.user.id).toBe(customer.id);

    await expect(
      createCustomerEvent(customer, form(), new Date("2026-10-03T12:00:00.000Z")),
    ).rejects.toMatchObject({ code: "inactive" });
    const stored = await prisma.user.findUnique({ where: { id: customer.id } });
    expect(stored?.accessStatus).toBe("EXPIRED");
    expect(stored).not.toBeNull();
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

  it("does not close an existing guest page when customer access expires", async () => {
    const customer = await signUpCustomer("Guest Still Open");
    await grantCustomerService(customer.id);
    const event = await createCustomerEvent(customer, form("Open guest"));
    await prisma.user.update({
      where: { id: customer.id },
      data: {
        accessStatus: "EXPIRED",
        accessExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
        emailVerified: false,
      },
    });
    const loaded = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        loaded && {
          status: loaded.event.status,
          expiresAt: loaded.event.expiresAt,
          customerDisabled: loaded.customerDisabled,
        },
        new Date(),
      ).state,
    ).toBe("ok");
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
