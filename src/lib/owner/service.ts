import type { Prisma } from "@/generated/prisma/client";
import { accessExpiryFromDays, accessStatusOf } from "@/lib/access";
import { PLATFORM_SETTINGS_ID } from "@/lib/events/defaults";
import { athensEndOfDay, calendarDateToDb, isExpiryPast } from "@/lib/events/expiry";
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
import { actorTypeForRole } from "@/lib/logging/catalog";
import { eraseDeletedCustomerLogs } from "@/lib/logging/erasure";
import { recordApplicationLog, recordUnexpectedError, requireApplicationLogRow } from "@/lib/logging/logger";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";
import { deleteConfiguredGuestRateLimits, guestRateLimitHitFilter } from "@/lib/uploads/rate-limit";

type Actor = {
  id: string;
  role: string;
};

async function requireOwner(actor: Actor | null) {
  if (!actor) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: "anonymous",
      result: "denied",
      metadata: { reason: "unauthenticated" },
    });
    throw new OwnerError("unauthorized");
  }

  if (actor.role !== "OWNER") {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      result: "denied",
      metadata: { reason: "forbidden" },
    });
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
  await requireOwner(actor);
  const lapsed = await prisma.user.findMany({
    where: {
      role: "CUSTOMER",
      accessExpiresAt: { lte: now },
    },
    select: { id: true },
  });

  if (lapsed.length > 0) {
    const ids = lapsed.map((customer) => customer.id);
    await prisma.user.updateMany({
      where: { id: { in: ids }, accessExpiresAt: { lte: now } },
      data: { disabled: true, accessStatus: "EXPIRED" },
    });
    const stillLapsed = await prisma.user.findMany({
      where: { id: { in: ids }, disabled: true, accessExpiresAt: { lte: now } },
      select: { id: true },
    });

    if (stillLapsed.length > 0) {
      await prisma.session.deleteMany({
        where: { userId: { in: stillLapsed.map((customer) => customer.id) } },
      });
    }
  }

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
  await requireOwner(actor);
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
  const owner = await requireOwner(actor);
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
  await recordApplicationLog({
    eventType: "account.access.changed",
    actorType: "owner",
    actorId: owner.id,
    targetType: "user",
    targetId: customer.id,
    result: "success",
    metadata: { fields: ["disabled", "accessStatus"] },
  });
}

export async function activateCustomerAccess(
  actor: Actor | null,
  userId: string,
  input: CustomerActivationValues,
  now = new Date(),
) {
  const owner = await requireOwner(actor);
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

  await recordApplicationLog({
    eventType: "account.access.changed",
    actorType: "owner",
    actorId: owner.id,
    targetType: "user",
    targetId: customer.id,
    result: "success",
    metadata: { fields: ["accessStatus"] },
  });

  return { accessExpiresAt };
}

export async function eraseCustomerAccount(
  customer: { id: string; email: string },
  storage: IStorageService | undefined,
  deletedBy: { actorType: "owner" | "customer"; actorId?: string },
) {
  const events = await prisma.event.findMany({
    where: { customerId: customer.id },
    select: { id: true, uniqueCode: true },
  });
  const eventIds = events.map((event) => event.id);
  const [mediaRows, albumRows] =
    eventIds.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.media.findMany({
            where: { eventId: { in: eventIds } },
            select: { id: true },
          }),
          prisma.album.findMany({
            where: { eventId: { in: eventIds } },
            select: { id: true },
          }),
        ]);

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
          ...events.flatMap((event) =>
            event.uniqueCode ? [guestRateLimitHitFilter(event.uniqueCode)] : [],
          ),
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

  try {
    await eraseDeletedCustomerLogs({
      userId: customer.id,
      eventIds,
      mediaIds: mediaRows.map((media) => media.id),
      albumIds: albumRows.map((album) => album.id),
    });
  } catch {
    // The account transaction has already committed. A later log rewrite must not restore it.
  }

  await recordApplicationLog({
    eventType: "account.deleted",
    actorType: deletedBy.actorType,
    ...(deletedBy.actorId ? { actorId: deletedBy.actorId } : {}),
    result: "success",
    metadata: { count: events.length },
  });

  try {
    await deleteConfiguredGuestRateLimits(events.map((event) => event.uniqueCode));
  } catch {
    await recordUnexpectedError();
  }
}

export async function deleteCustomerPermanently(
  actor: Actor | null,
  userId: string,
  confirmEmail: string,
  storage?: IStorageService,
) {
  const owner = await requireOwner(actor);

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

  await eraseCustomerAccount(customer, storage, {
    actorType: "owner",
    actorId: owner.id,
  });
}

export async function listOwnerEvents(actor: Actor | null) {
  await requireOwner(actor);

  return prisma.event.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: { id: true, name: true, email: true, disabled: true, accessExpiresAt: true },
      },
    },
  });
}

export async function getOwnerEvent(actor: Actor | null, eventId: string) {
  await requireOwner(actor);

  return prisma.event.findUnique({
    where: { id: eventId },
    include: {
      customer: {
        select: { id: true, name: true, email: true, accessExpiresAt: true },
      },
    },
  });
}

export async function createOwnerEvent(actor: Actor | null, input: OwnerCreateValues) {
  const owner = await requireOwner(actor);
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
      panelStyle: input.panelStyle,
      accentColor: input.accentColor,
      titleFont: input.titleFont,
      guestFont: input.guestFont,
      logoSize: input.logoSize,
      logoCorner: input.logoCorner,
      privacyMode: input.privacyMode,
      guestDownloadsEnabled: true,
      status: input.status,
    },
    new Date(),
    { enforceServiceAccess: false, enforceEventLimit: false, performedBy: owner },
  );
}

export async function updateOwnerEvent(
  actor: Actor | null,
  eventId: string,
  input: OwnerUpdateValues,
) {
  const owner = await requireOwner(actor);
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      customerId: true,
      status: true,
      privacyMode: true,
      maxStorageBytes: true,
    },
  });

  if (!existing) {
    throw new OwnerError("notFound");
  }

  await requireCustomer(input.customerId);

  const updated = await prisma.event.update({
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
      panelStyle: input.panelStyle,
      accentColor: input.accentColor,
      titleFont: input.titleFont,
      guestFont: input.guestFont,
      logoSize: input.logoSize,
      logoCorner: input.logoCorner,
      status: input.status,
      privacyMode: input.privacyMode,
      maxStorageBytes: mibToBytes(input.quotaMib),
    },
  });
  const nextQuota = mibToBytes(input.quotaMib);
  const fields = [
    ...(existing.customerId !== input.customerId ? ["customerId" as const] : []),
    ...(existing.status !== input.status ? ["status" as const] : []),
    ...(existing.privacyMode !== input.privacyMode ? ["privacyMode" as const] : []),
    ...(existing.maxStorageBytes !== nextQuota ? ["maxStorageBytes" as const] : []),
  ];

  if (fields.length > 0) {
    await recordApplicationLog({
      eventType: "event.updated",
      actorType: "owner",
      actorId: owner.id,
      targetType: "event",
      targetId: updated.id,
      result: "success",
      metadata: {
        fields,
        ...(fields.includes("privacyMode") ? { privacyMode: input.privacyMode } : {}),
        ...(fields.includes("status") ? { eventStatus: input.status } : {}),
        ...(fields.includes("maxStorageBytes") ? { quotaMib: input.quotaMib } : {}),
      },
    });
  }

  return updated;
}

export async function deleteOwnerEvent(
  actor: Actor | null,
  eventId: string,
  storage?: IStorageService,
) {
  const owner = await requireOwner(actor);

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
  await requireOwner(actor);
  const settings = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!settings) {
    throw new OwnerError("invalid");
  }

  return settings;
}

export async function updateOwnerSettings(actor: Actor | null, input: OwnerSettingsValues) {
  const owner = await requireOwner(actor);
  const logRow = requireApplicationLogRow({
    eventType: "settings.updated",
    actorType: "owner",
    actorId: owner.id,
    targetType: "settings",
    targetId: PLATFORM_SETTINGS_ID,
    result: "success",
    metadata: {
      fields: [
        "defaultMaxStorageBytes",
        "maxPhotoBytes",
        "maxVideoBytes",
        "maxEventsPerCustomer",
      ],
      quotaMib: input.defaultQuotaMib,
      maxPhotoMib: input.maxPhotoMib,
      maxVideoMib: input.maxVideoMib,
      maxEventsPerCustomer: input.maxEventsPerCustomer,
    },
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.platformSettings.update({
      where: { id: PLATFORM_SETTINGS_ID },
      data: {
        defaultMaxStorageBytes: mibToBytes(input.defaultQuotaMib),
        maxPhotoBytes: mibToBytes(input.maxPhotoMib),
        maxVideoBytes: mibToBytes(input.maxVideoMib),
        maxEventsPerCustomer: input.maxEventsPerCustomer,
      },
    });

    await tx.applicationLog.create({
      data: {
        id: logRow.id,
        eventType: logRow.eventType,
        actorType: logRow.actorType,
        actorId: logRow.actorId,
        targetType: logRow.targetType,
        targetId: logRow.targetId,
        result: logRow.result,
        requestId: logRow.requestId,
        metadata: logRow.metadata as Prisma.InputJsonValue,
      },
    });

    return updated;
  });
}

export async function platformCounts(actor: Actor | null) {
  await requireOwner(actor);
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
