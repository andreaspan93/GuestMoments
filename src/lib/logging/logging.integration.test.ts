import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { grantCustomerService } from "@/lib/access";
import { auth } from "@/lib/auth";
import { deleteCustomerEvent, createCustomerEvent } from "@/lib/events/service";
import type { EventFormValues } from "@/lib/events/schema";
import { mutateCustomerMedia } from "@/lib/gallery/service";
import { deleteExpiredApplicationLogs } from "@/lib/logging/retention";
import { prisma } from "@/lib/prisma";
import { createGuestToken } from "@/lib/uploads/token";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `logs-${randomUUID()}@example.com`;
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
  return { ...user, email };
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

describe("application logs", () => {
  afterAll(async () => {
    const users = await prisma.user.findMany({
      where: { email: { in: createdEmails } },
      select: { id: true },
    });
    const ids = users.map((user) => user.id);

    await prisma.applicationLog.deleteMany({
      where: {
        OR: [{ actorId: { in: ids } }, { targetId: { in: ids } }],
      },
    });
    await prisma.event.deleteMany({
      where: { customerId: { in: ids } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
    await prisma.$disconnect();
  });

  it("records account creation without the email address or name", async () => {
    const customer = await signUpCustomer("Log Guest");
    const row = await prisma.applicationLog.findFirst({
      where: {
        eventType: "account.created",
        targetId: customer.id,
      },
    });
    const stored = JSON.stringify(row);

    expect(row).toMatchObject({
      actorType: "customer",
      actorId: customer.id,
      targetType: "user",
      result: "success",
    });
    expect(stored).not.toContain(customer.email);
    expect(stored).not.toContain("Log Guest");
    expect(stored).not.toContain("Password123!");
  });

  it("records event changes and a cross-customer denial without the event name", async () => {
    const owner = await signUpCustomer("Event owner");
    const other = await signUpCustomer("Other guest");
    const event = await createCustomerEvent(owner, form("Private wedding"));
    const created = await prisma.applicationLog.findFirst({
      where: { eventType: "event.created", targetId: event.id },
    });

    expect(created?.actorId).toBe(owner.id);
    expect(JSON.stringify(created)).not.toContain("Private wedding");
    expect(JSON.stringify(created)).not.toContain(event.uniqueCode);

    await expect(deleteCustomerEvent(other, event.id)).rejects.toMatchObject({
      code: "notFound",
    });
    await expect(
      prisma.applicationLog.findFirst({
        where: {
          eventType: "access.denied",
          actorId: other.id,
          targetId: event.id,
        },
      }),
    ).resolves.toMatchObject({
      result: "denied",
    });
    expect(await prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it("records a media visibility change without the guest token", async () => {
    const customer = await signUpCustomer("Gallery owner");
    const event = await createCustomerEvent(customer, form("Gallery wedding"));
    const guestToken = createGuestToken();
    const media = await prisma.media.create({
      data: {
        id: randomUUID(),
        eventId: event.id,
        storageKey: `events/${event.id}/${randomUUID()}`,
        type: "PHOTO",
        originalFileName: "secret-name.jpg",
        size: BigInt(10),
        mimeType: "image/jpeg",
        guestToken,
      },
    });

    await mutateCustomerMedia(customer, event.id, media.id, "hide");
    const row = await prisma.applicationLog.findFirst({
      where: { eventType: "media.visibility.changed", targetId: media.id },
    });
    const stored = JSON.stringify(row);

    expect(row).toMatchObject({
      actorId: customer.id,
      result: "success",
    });
    expect(stored).not.toContain(guestToken);
    expect(stored).not.toContain("secret-name.jpg");
  });

  it("deletes only expired application logs", async () => {
    const customer = await signUpCustomer("Retention guest");
    const oldOperational = randomUUID();
    const recentOperational = randomUUID();
    const recentSecurity = randomUUID();

    await prisma.applicationLog.createMany({
      data: [
        {
          id: oldOperational,
          eventType: "event.created",
          actorType: "customer",
          actorId: customer.id,
          result: "success",
          metadata: {},
          createdAt: new Date("2020-01-01T00:00:00.000Z"),
        },
        {
          id: recentOperational,
          eventType: "event.created",
          actorType: "customer",
          actorId: customer.id,
          result: "success",
          metadata: {},
        },
        {
          id: recentSecurity,
          eventType: "auth.password.changed",
          actorType: "customer",
          actorId: customer.id,
          result: "success",
          metadata: {},
          createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        },
      ],
    });

    const deleted = await deleteExpiredApplicationLogs(new Date());

    expect(deleted.operational).toBeGreaterThanOrEqual(1);
    expect(await prisma.applicationLog.findUnique({ where: { id: oldOperational } })).toBeNull();
    expect(
      await prisma.applicationLog.findUnique({ where: { id: recentOperational } }),
    ).not.toBeNull();
    expect(
      await prisma.applicationLog.findUnique({ where: { id: recentSecurity } }),
    ).not.toBeNull();
    expect(await prisma.user.findUnique({ where: { id: customer.id } })).not.toBeNull();
  });
});
