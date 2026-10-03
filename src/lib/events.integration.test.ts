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
import { expiresAtFor } from "@/lib/events/expiry";
import { EventError, type EventFormValues } from "@/lib/events/schema";
import {
  createCustomerEvent,
  getCustomerEvent,
  listCustomerEvents,
  loadGuestEvent,
  updateCustomerEvent,
} from "@/lib/events/service";
import { prisma } from "@/lib/prisma";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase3-${randomUUID()}@example.com`;
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

function form(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    name: "Alex and Niki",
    eventDate: "2027-06-15",
    welcomeMessageEl: "Καλώς ήρθατε",
    welcomeMessageEn: "",
    uploadInstructionsEl: "Ανεβάστε τις στιγμές σας",
    uploadInstructionsEn: "",
    backgroundColor: "#f7f1ea",
    accentColor: "#8c3d32",
    privacyMode: "FULL_GALLERY",
    status: "ACTIVE",
    ...overrides,
  };
}

async function setRetention(days: number) {
  await prisma.platformSettings.update({
    where: { id: PLATFORM_SETTINGS_ID },
    data: { defaultRetentionDays: days },
  });
}

describe("events", () => {
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
        defaultRetentionDays: 90,
        defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
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

  it("copies retention and quota, then leaves them when settings change", async () => {
    const customer = await signUpCustomer("Copy Customer");
    await setRetention(30);
    const created = await createCustomerEvent(customer, form({ eventDate: "2027-08-01" }));
    const originalExpiry = created.expiresAt;

    expect(created.retentionDays).toBe(30);
    expect(created.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
    expect(created.expiresAt.toISOString()).toBe(
      expiresAtFor("2027-08-01", 30).toISOString(),
    );
    expect(created.uniqueCode.length).toBeGreaterThanOrEqual(21);

    await setRetention(10);
    const untouched = await prisma.event.findUniqueOrThrow({
      where: { id: created.id },
    });

    expect(untouched.retentionDays).toBe(30);
    expect(untouched.expiresAt.toISOString()).toBe(originalExpiry.toISOString());

    const updated = await updateCustomerEvent(
      customer,
      created.id,
      form({ eventDate: "2027-09-01", name: "Updated wedding" }),
    );

    expect(updated.retentionDays).toBe(30);
    expect(updated.name).toBe("Updated wedding");
    expect(updated.expiresAt.toISOString()).toBe(
      expiresAtFor("2027-09-01", 30).toISOString(),
    );
  });

  it("rejects a date whose expiry is already past", async () => {
    const customer = await signUpCustomer("Past Customer");
    await setRetention(1);

    await expect(
      createCustomerEvent(customer, form({ eventDate: "2020-01-01" })),
    ).rejects.toMatchObject({ code: "pastExpiry" });

    await expect(
      prisma.event.count({ where: { customerId: customer.id } }),
    ).resolves.toBe(0);
  });

  it("hides one customer's event from another customer", async () => {
    const first = await signUpCustomer("Customer A");
    const second = await signUpCustomer("Customer B");
    await setRetention(90);
    const event = await createCustomerEvent(first, form({ name: "Private event" }));

    expect(await getCustomerEvent(second, event.id)).toBeNull();
    await expect(listCustomerEvents(second)).resolves.toEqual([]);
    await expect(
      updateCustomerEvent(second, event.id, form({ name: "Stolen" })),
    ).rejects.toBeInstanceOf(EventError);

    const stored = await prisma.event.findUniqueOrThrow({ where: { id: event.id } });
    expect(stored.name).toBe("Private event");
    expect(stored.customerId).toBe(first.id);

    const visible = await listCustomerEvents(first);
    expect(visible.map((item) => item.id)).toContain(event.id);
  });

  it("lets the owner read another customer's event", async () => {
    const customer = await signUpCustomer("Owned Customer");
    const owner = await signUpCustomer("Owner Reader");
    await prisma.user.update({
      where: { id: owner.id },
      data: { role: "OWNER" },
    });
    await setRetention(90);
    const event = await createCustomerEvent(customer, form());
    const found = await getCustomerEvent(
      { id: owner.id, role: "OWNER" },
      event.id,
    );

    expect(found?.id).toBe(event.id);
  });

  it("refuses unknown, expired, and disabled-customer guest pages", async () => {
    expect(await loadGuestEvent(`missing-${randomUUID()}`)).toBeNull();
    expect(decideGuestAccess(null, new Date()).state).toBe("not_found");

    const customer = await signUpCustomer("Guest Gate");
    await setRetention(90);
    const event = await createCustomerEvent(customer, form());
    const loaded = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        loaded && {
          status: loaded.event.status,
          expiresAt: loaded.event.expiresAt,
          customerDisabled: loaded.customerDisabled,
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ).state,
    ).toBe("ok");

    await prisma.event.update({
      where: { id: event.id },
      data: { expiresAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    const expired = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        expired && {
          status: expired.event.status,
          expiresAt: expired.event.expiresAt,
          customerDisabled: expired.customerDisabled,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");

    await prisma.event.update({
      where: { id: event.id },
      data: { expiresAt: event.expiresAt },
    });
    await prisma.user.update({
      where: { id: customer.id },
      data: { disabled: true },
    });
    const disabled = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        disabled && {
          status: disabled.event.status,
          expiresAt: disabled.event.expiresAt,
          customerDisabled: disabled.customerDisabled,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");
  });
});
