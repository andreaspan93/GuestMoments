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

function form(overrides: Partial<EventFormValues> = {}): EventFormValues {
  return {
    name: "Alex and Niki",
    eventDate: "2027-06-15",
    welcomeMessageEl: "Καλώς ήρθατε",
    welcomeMessageEn: "",
    uploadInstructionsEl: "Ανεβάστε τις στιγμές σας",
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

describe("events", () => {
  beforeAll(async () => {
    await prisma.platformSettings.upsert({
      where: { id: PLATFORM_SETTINGS_ID },
      create: {
        id: PLATFORM_SETTINGS_ID,
        maxPhotoBytes: DEFAULT_MAX_PHOTO_BYTES,
        maxVideoBytes: DEFAULT_MAX_VIDEO_BYTES,
        defaultMaxStorageBytes: DEFAULT_MAX_STORAGE_BYTES,
      },
      update: {
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

  it("stores a past wedding date while customer access is still active", async () => {
    const customer = await signUpCustomer("Copy Customer");
    const created = await createCustomerEvent(
      customer,
      form({ eventDate: "2027-08-01" }),
    );

    expect(created.maxStorageBytes).toBe(DEFAULT_MAX_STORAGE_BYTES);
    expect(created.uniqueCode.length).toBeGreaterThanOrEqual(21);

    const past = await createCustomerEvent(
      customer,
      form({ eventDate: "2020-01-01", name: "Earlier wedding" }),
    );

    expect(past.eventDate.toISOString().slice(0, 10)).toBe("2020-01-01");

    const updated = await updateCustomerEvent(
      customer,
      created.id,
      form({ eventDate: "2027-09-01", name: "Updated wedding" }),
    );

    expect(updated.name).toBe("Updated wedding");
    expect(created.panelStyle).toBe("solid");

    const styled = await updateCustomerEvent(
      customer,
      created.id,
      form({ panelStyle: "frosted" }),
    );

    expect(styled.panelStyle).toBe("frosted");
    const reloaded = await prisma.event.findUniqueOrThrow({ where: { id: created.id } });
    expect(reloaded.panelStyle).toBe("frosted");
  });

  it("stops a customer at the event limit without deleting events they already have", async () => {
    const customer = await signUpCustomer("Limit Customer");

    try {
      await prisma.platformSettings.update({
        where: { id: PLATFORM_SETTINGS_ID },
        data: { maxEventsPerCustomer: 2 },
      });
      await createCustomerEvent(customer, form({ name: "First wedding" }));
      await createCustomerEvent(customer, form({ name: "Second wedding" }));
      await prisma.platformSettings.update({
        where: { id: PLATFORM_SETTINGS_ID },
        data: { maxEventsPerCustomer: 1 },
      });

      await expect(prisma.event.count({ where: { customerId: customer.id } })).resolves.toBe(2);
      await expect(createCustomerEvent(customer, form({ name: "Third wedding" }))).rejects.toMatchObject({
        code: "eventLimit",
      });
      await expect(prisma.event.count({ where: { customerId: customer.id } })).resolves.toBe(2);
      await expect(
        createCustomerEvent(customer, form({ name: "Admin wedding" }), new Date(), {
          enforceEventLimit: false,
        }),
      ).resolves.toMatchObject({ name: "Admin wedding" });
    } finally {
      await prisma.platformSettings.update({
        where: { id: PLATFORM_SETTINGS_ID },
        data: { maxEventsPerCustomer: 10 },
      });
    }
  });

  it("hides one customer's event from another customer", async () => {
    const first = await signUpCustomer("Customer A");
    const second = await signUpCustomer("Customer B");
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
    const event = await createCustomerEvent(customer, form());
    const loaded = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        loaded && {
          status: loaded.event.status,
          customerDisabled: loaded.customerDisabled,
          customerAccessExpiresAt: loaded.customerAccessExpiresAt,
        },
        new Date("2026-01-01T00:00:00.000Z"),
      ).state,
    ).toBe("ok");

    await prisma.user.update({
      where: { id: customer.id },
      data: { accessExpiresAt: new Date("2020-01-01T00:00:00.000Z") },
    });
    const expired = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        expired && {
          status: expired.event.status,
          customerDisabled: expired.customerDisabled,
          customerAccessExpiresAt: expired.customerAccessExpiresAt,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");

    await prisma.user.update({
      where: { id: customer.id },
      data: { disabled: true, accessExpiresAt: new Date("2099-01-01T00:00:00.000Z") },
    });
    const disabled = await loadGuestEvent(event.uniqueCode);

    expect(
      decideGuestAccess(
        disabled && {
          status: disabled.event.status,
          customerDisabled: disabled.customerDisabled,
          customerAccessExpiresAt: disabled.customerAccessExpiresAt,
        },
        new Date(),
      ).state,
    ).toBe("unavailable");
  });

  it("saves appearance choices and keeps them on a later edit", async () => {
    const customer = await signUpCustomer("Appearance Customer");
    const created = await createCustomerEvent(
      customer,
      form({
        titleFont: "literata",
        guestFont: "noto-serif",
        welcomeFont: "gfs-didot",
        titleBold: false,
        guestBold: true,
        welcomeBold: true,
        logoSize: "extra-large",
        logoCorner: "rounded",
      }),
    );

    expect(created.titleFont).toBe("literata");
    expect(created.guestFont).toBe("noto-serif");
    expect(created.welcomeFont).toBe("gfs-didot");
    expect(created.titleBold).toBe(false);
    expect(created.guestBold).toBe(true);
    expect(created.welcomeBold).toBe(true);
    expect(created.logoSize).toBe("extra-large");
    expect(created.logoCorner).toBe("rounded");
    expect(created.guestDownloadsEnabled).toBe(true);

    const reloaded = await getCustomerEvent(customer, created.id);
    expect(reloaded?.logoSize).toBe("extra-large");
    expect(reloaded?.logoCorner).toBe("rounded");

    const updated = await updateCustomerEvent(
      customer,
      created.id,
      form({
        titleFont: "eb-garamond",
        guestFont: "source-sans",
        welcomeFont: "alegreya",
        titleBold: true,
        guestBold: false,
        welcomeBold: false,
        logoSize: "small",
        logoCorner: "square",
        guestDownloadsEnabled: false,
      }),
    );

    expect(updated.titleFont).toBe("eb-garamond");
    expect(updated.guestFont).toBe("source-sans");
    expect(updated.welcomeFont).toBe("alegreya");
    expect(updated.titleBold).toBe(true);
    expect(updated.guestBold).toBe(false);
    expect(updated.welcomeBold).toBe(false);
    expect(updated.logoSize).toBe("small");
    expect(updated.logoCorner).toBe("square");
    expect(updated.guestDownloadsEnabled).toBe(false);
    expect(updated.name).toBe("Alex and Niki");
  });
});
