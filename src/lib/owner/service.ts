import { accessExpiryFromDays, accessStatusOf } from "@/lib/access";
import { PLATFORM_SETTINGS_ID } from "@/lib/events/defaults";
import {
  athensEndOfDay,
  calendarDateToDb,
  expiresAtFor,
  isExpiryPast,
} from "@/lib/events/expiry";
import { EventError } from "@/lib/events/schema";
import {
  createCustomerEvent,
  deleteCustomerEvent,
} from "@/lib/events/service";
import { formatStorage } from "@/lib/gallery/present";
import { mibToBytes } from "@/lib/owner/bytes";
import {
  OwnerError,
  type CustomerActivationValues,
  type OwnerCreateValues,
  type OwnerSettingsValues,
  type OwnerUpdateValues,
} from "@/lib/owner/schema";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";

type Actor = {
  id: string;
  role: string;
};

function requireOwner(actor: Actor | null) {
  if (!actor) {
    throw new OwnerError("unauthorized");
  }

  if (actor.role !== "OWNER") {
    throw new OwnerError("forbidden");
  }

  return actor;
}

async function requireCustomer(customerId: string) {
  const id = customerId.trim();

  if (id.length === 0 || id.length > 128) {
    throw new OwnerError("invalid");
  }

  const customer = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: { id: true },
  });

  if (!customer) {
    throw new OwnerError("notFound");
  }

  return customer;
}

export async function listOwnerCustomers(actor: Actor | null, now = new Date()) {
  requireOwner(actor);
  await prisma.user.updateMany({
    where: {
      role: "CUSTOMER",
      disabled: false,
      accessStatus: "ACTIVE",
      accessExpiresAt: { lte: now },
    },
    data: { accessStatus: "EXPIRED" },
  });

  const customers = await prisma.user.findMany({
    where: { role: "CUSTOMER" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      disabled: true,
      accessStatus: true,
      accessExpiresAt: true,
      createdAt: true,
      _count: { select: { events: true } },
    },
  });

  return customers.map((customer) => ({
    ...customer,
    accessStatus: accessStatusOf({ ...customer, role: "CUSTOMER" }, now),
  }));
}

export async function getOwnerCustomer(actor: Actor | null, userId: string, now = new Date()) {
  requireOwner(actor);
  await requireCustomer(userId);

  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      disabled: true,
      accessStatus: true,
      accessExpiresAt: true,
      createdAt: true,
      role: true,
      _count: { select: { events: true } },
    },
  });

  if (!customer || customer.role !== "CUSTOMER") {
    throw new OwnerError("notFound");
  }

  return {
    ...customer,
    accessStatus: accessStatusOf(customer, now),
  };
}

export async function setCustomerDisabled(
  actor: Actor | null,
  userId: string,
  disabled: boolean,
) {
  requireOwner(actor);
  const customer = await requireCustomer(userId);

  const current = await prisma.user.findUniqueOrThrow({
    where: { id: customer.id },
    select: { accessExpiresAt: true, accessStatus: true },
  });
  const now = new Date();
  const restored =
    current.accessExpiresAt && current.accessExpiresAt.getTime() > now.getTime()
      ? "ACTIVE"
      : current.accessExpiresAt
        ? "EXPIRED"
        : "PENDING";

  await prisma.$transaction([
    prisma.user.update({
      where: { id: customer.id },
      data: disabled
        ? { disabled: true, accessStatus: "DISABLED" }
        : { disabled: false, accessStatus: restored },
    }),
    ...(disabled
      ? [prisma.session.deleteMany({ where: { userId: customer.id } })]
      : []),
  ]);
}

export async function activateCustomerAccess(
  actor: Actor | null,
  userId: string,
  input: CustomerActivationValues,
  now = new Date(),
) {
  requireOwner(actor);
  const customer = await requireCustomer(userId);
  const current = await prisma.user.findUniqueOrThrow({
    where: { id: customer.id },
    select: { accessExpiresAt: true, disabled: true, accessStatus: true },
  });
  let accessExpiresAt: Date;

  if (input.duration === "custom") {
    accessExpiresAt = athensEndOfDay(input.expiresOn);

    if (isExpiryPast(accessExpiresAt, now)) {
      throw new OwnerError("invalid");
    }
  } else {
    const base =
      !current.disabled &&
      current.accessStatus === "ACTIVE" &&
      current.accessExpiresAt &&
      current.accessExpiresAt.getTime() > now.getTime()
        ? current.accessExpiresAt
        : now;
    accessExpiresAt = accessExpiryFromDays(Number(input.duration), base);
  }

  await prisma.user.update({
    where: { id: customer.id },
    data: {
      disabled: false,
      accessStatus: "ACTIVE",
      accessExpiresAt,
    },
  });

  return { accessExpiresAt };
}

export async function deleteCustomerPermanently(
  actor: Actor | null,
  userId: string,
  confirmEmail: string,
  storage?: IStorageService,
) {
  const owner = requireOwner(actor);

  if (owner.id === userId) {
    throw new OwnerError("forbidden");
  }

  const customer = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true },
  });

  if (!customer) {
    throw new OwnerError("notFound");
  }

  if (customer.role !== "CUSTOMER") {
    throw new OwnerError("forbidden");
  }

  if (customer.email.trim().toLowerCase() !== confirmEmail.trim().toLowerCase()) {
    throw new OwnerError("confirmEmail");
  }

  const events = await prisma.event.findMany({
    where: { customerId: customer.id },
    select: { id: true },
  });

  if (events.length > 0) {
    const store = storage ?? getStorage();

    try {
      for (const event of events) {
        await store.deletePrefix(eventStoragePrefix(event.id));
      }
    } catch (error) {
      if (error instanceof OwnerError) {
        throw error;
      }

      throw new OwnerError("storage");
    }
  }

  const eventIds = events.map((event) => event.id);

  await prisma.$transaction([
    prisma.verification.deleteMany({
      where: {
        OR: [{ value: customer.id }, { identifier: customer.email }],
      },
    }),
    prisma.rateLimitHit.deleteMany({
      where: {
        OR: [
          { bucket: { startsWith: `branding:${customer.id}:` } },
          ...eventIds.map((eventId) => ({ bucket: { contains: eventId } })),
        ],
      },
    }),
    prisma.event.deleteMany({
      where: { customerId: customer.id },
    }),
    prisma.session.deleteMany({
      where: { userId: customer.id },
    }),
    prisma.account.deleteMany({
      where: { userId: customer.id },
    }),
    prisma.user.delete({
      where: { id: customer.id },
    }),
  ]);
}

export async function listOwnerEvents(actor: Actor | null) {
  requireOwner(actor);

  return prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: { id: true, name: true, email: true, disabled: true },
      },
    },
  });
}

export async function getOwnerEvent(actor: Actor | null, eventId: string) {
  requireOwner(actor);

  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      customer: {
        select: { id: true, name: true, email: true },
      },
    },
  });
}

export async function createOwnerEvent(actor: Actor | null, input: OwnerCreateValues) {
  requireOwner(actor);
  const customer = await requireCustomer(input.customerId);

  return createCustomerEvent(
    { id: customer.id, role: "CUSTOMER" },
    {
      name: input.name,
      eventDate: input.eventDate,
      welcomeMessageEl: input.welcomeMessageEl,
      welcomeMessageEn: input.welcomeMessageEn,
      uploadInstructionsEl: input.uploadInstructionsEl,
      uploadInstructionsEn: input.uploadInstructionsEn,
      backgroundColor: input.backgroundColor,
      accentColor: input.accentColor,
      privacyMode: input.privacyMode,
      status: input.status,
    },
    new Date(),
    { enforceServiceAccess: false },
  );
}

export async function updateOwnerEvent(
  actor: Actor | null,
  eventId: string,
  input: OwnerUpdateValues,
  now = new Date(),
) {
  requireOwner(actor);
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!existing) {
    throw new OwnerError("notFound");
  }

  await requireCustomer(input.customerId);
  const expiresAt = expiresAtFor(input.eventDate, input.retentionDays);

  if (isExpiryPast(expiresAt, now)) {
    throw new OwnerError("pastExpiry");
  }

  return prisma.event.update({
    where: { id: existing.id },
    data: {
      customerId: input.customerId,
      name: input.name,
      eventDate: calendarDateToDb(input.eventDate),
      welcomeMessageEl: input.welcomeMessageEl,
      welcomeMessageEn: input.welcomeMessageEn,
      uploadInstructionsEl: input.uploadInstructionsEl,
      uploadInstructionsEn: input.uploadInstructionsEn,
      backgroundColor: input.backgroundColor,
      accentColor: input.accentColor,
      status: input.status,
      privacyMode: input.privacyMode,
      retentionDays: input.retentionDays,
      maxStorageBytes: mibToBytes(input.quotaMib),
      expiresAt,
    },
  });
}

export async function deleteOwnerEvent(
  actor: Actor | null,
  eventId: string,
  storage?: IStorageService,
) {
  const owner = requireOwner(actor);

  try {
    await deleteCustomerEvent(owner, eventId, storage);
  } catch (error) {
    if (error instanceof EventError) {
      throw new OwnerError(error.code === "notFound" ? "notFound" : "invalid");
    }

    throw error;
  }
}

export async function getOwnerSettings(actor: Actor | null) {
  requireOwner(actor);
  const settings = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!settings) {
    throw new OwnerError("invalid");
  }

  return settings;
}

export async function updateOwnerSettings(actor: Actor | null, input: OwnerSettingsValues) {
  requireOwner(actor);

  return prisma.platformSettings.update({
    where: { id: PLATFORM_SETTINGS_ID },
    data: {
      defaultRetentionDays: input.defaultRetentionDays,
      defaultMaxStorageBytes: mibToBytes(input.defaultQuotaMib),
      maxPhotoBytes: mibToBytes(input.maxPhotoMib),
      maxVideoBytes: mibToBytes(input.maxVideoMib),
    },
  });
}

export async function platformCounts(actor: Actor | null) {
  requireOwner(actor);
  const [customers, events, media, storage] = await prisma.$transaction([
    prisma.user.count({ where: { role: "CUSTOMER" } }),
    prisma.event.count(),
    prisma.media.count(),
    prisma.media.aggregate({ _sum: { size: true } }),
  ]);
  const storageBytes = storage._sum.size ?? BigInt(0);

  return {
    customers,
    events,
    media,
    storageBytes,
    storageLabel: formatStorage(storageBytes),
  };
}
