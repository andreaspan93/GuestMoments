import { randomUUID } from "node:crypto";
import { customerHasServiceAccess } from "@/lib/access";
import { eventScope } from "@/lib/events/access";
import { createEventCode } from "@/lib/events/code";
import { PLATFORM_SETTINGS_ID } from "@/lib/events/defaults";
import { calendarDateFromDb, calendarDateToDb } from "@/lib/events/expiry";
import { EventError, type EventFormValues } from "@/lib/events/schema";
import { actorTypeForRole } from "@/lib/logging/catalog";
import { recordCrossCustomerEventAccess } from "@/lib/logging/access";
import { recordApplicationLog, recordUnexpectedError } from "@/lib/logging/logger";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";
import {
  deleteConfiguredGuestRateLimits,
  eventRateLimitHitWhere,
} from "@/lib/uploads/rate-limit";

type Actor = {
  id: string;
  role: string;
};

async function platformSettings() {
  const settings = await prisma.platformSettings.findUnique({
    where: { id: PLATFORM_SETTINGS_ID },
  });

  if (!settings) {
    throw new EventError("invalid");
  }

  return settings;
}

async function insertEvent(data: {
  customerId: string;
  name: string;
  eventDate: Date;
  welcomeMessageEl: string;
  welcomeMessageEn: string;
  uploadInstructionsEl: string;
  uploadInstructionsEn: string;
  backgroundColor: string;
  panelStyle: string;
  accentColor: string;
  titleFont: string;
  guestFont: string;
  logoSize: string;
  logoCorner: string;
  status: string;
  privacyMode: string;
  guestDownloadsEnabled: boolean;
  maxStorageBytes: bigint;
}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.event.create({
        data: {
          id: randomUUID(),
          uniqueCode: createEventCode(),
          ...data,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002" &&
        attempt < 4
      ) {
        continue;
      }

      throw error;
    }
  }

  throw new EventError("invalid");
}

async function ensureCustomerService(
  actor: Actor,
  now: Date,
  enforce = true,
) {
  if (!enforce || actor.role === "OWNER") {
    return;
  }

  if (!(await customerHasServiceAccess(actor, now))) {
    await recordApplicationLog({
      eventType: "access.denied",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      result: "denied",
      metadata: { reason: "inactive" },
    });
    throw new EventError("inactive");
  }
}

export async function customerEventAllowance(actor: Actor) {
  const settings = await platformSettings();
  const eventCount = await prisma.event.count({
    where: { customerId: actor.id },
  });

  return {
    maxEvents: settings.maxEventsPerCustomer,
    eventCount,
    atLimit: actor.role !== "OWNER" && eventCount >= settings.maxEventsPerCustomer,
  };
}

export async function createCustomerEvent(
  actor: Actor,
  input: EventFormValues,
  now = new Date(),
  options?: {
    enforceServiceAccess?: boolean;
    enforceEventLimit?: boolean;
    performedBy?: Actor;
  },
) {
  await ensureCustomerService(actor, now, options?.enforceServiceAccess !== false);
  const settings = await platformSettings();

  if (options?.enforceEventLimit !== false && actor.role !== "OWNER") {
    const eventCount = await prisma.event.count({
      where: { customerId: actor.id },
    });

    if (eventCount >= settings.maxEventsPerCustomer) {
      throw new EventError("eventLimit");
    }
  }

  const created = await insertEvent({
    customerId: actor.id,
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
    guestDownloadsEnabled: input.guestDownloadsEnabled,
    maxStorageBytes: settings.defaultMaxStorageBytes,
  });
  const performedBy = options?.performedBy ?? actor;

  await recordApplicationLog({
    eventType: "event.created",
    actorType: actorTypeForRole(performedBy.role),
    actorId: performedBy.id,
    targetType: "event",
    targetId: created.id,
    result: "success",
    metadata: {
      privacyMode: created.privacyMode,
      eventStatus: created.status,
    },
  });

  return created;
}

export async function updateCustomerEvent(
  actor: Actor,
  eventId: string,
  input: EventFormValues,
  now = new Date(),
) {
  await ensureCustomerService(actor, now);
  const existing = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...eventScope(actor),
    },
  });

  if (!existing) {
    await recordCrossCustomerEventAccess(actor, eventId);
    throw new EventError("notFound");
  }

  const updated = await prisma.event.update({
    where: { id: existing.id },
    data: {
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
      guestDownloadsEnabled: input.guestDownloadsEnabled,
    },
  });
  const fields = [
    ...(existing.privacyMode !== input.privacyMode ? ["privacyMode" as const] : []),
    ...(existing.guestDownloadsEnabled !== input.guestDownloadsEnabled
      ? ["guestDownloadsEnabled" as const]
      : []),
    ...(existing.status !== input.status ? ["status" as const] : []),
  ];

  if (fields.length > 0) {
    await recordApplicationLog({
      eventType: "event.updated",
      actorType: actorTypeForRole(actor.role),
      actorId: actor.id,
      targetType: "event",
      targetId: updated.id,
      result: "success",
      metadata: {
        fields,
        ...(fields.includes("privacyMode") ? { privacyMode: input.privacyMode } : {}),
        ...(fields.includes("status") ? { eventStatus: input.status } : {}),
      },
    });
  }

  return updated;
}

export async function deleteCustomerEvent(
  actor: Actor,
  eventId: string,
  storage?: IStorageService,
) {
  await ensureCustomerService(actor, new Date());
  const existing = await prisma.event.findFirst({
    where: {
      id: eventId,
      ...eventScope(actor),
    },
    select: { id: true, uniqueCode: true },
  });

  if (!existing) {
    await recordCrossCustomerEventAccess(actor, eventId);
    throw new EventError("notFound");
  }

  await (storage ?? getStorage()).deletePrefix(eventStoragePrefix(existing.id));
  await prisma.event.delete({
    where: { id: existing.id },
  });

  const rateLimitWhere = eventRateLimitHitWhere(existing.id, existing.uniqueCode);

  if (rateLimitWhere) {
    try {
      await prisma.rateLimitHit.deleteMany({ where: rateLimitWhere });
    } catch {
      await recordUnexpectedError();
    }
  }

  try {
    await deleteConfiguredGuestRateLimits([existing.uniqueCode]);
  } catch {
    await recordUnexpectedError();
  }

  await recordApplicationLog({
    eventType: "event.deleted",
    actorType: actorTypeForRole(actor.role),
    actorId: actor.id,
    targetType: "event",
    targetId: existing.id,
    result: "success",
  });
}

export async function listCustomerEvents(actor: Actor) {
  return prisma.event.findMany({
    where: eventScope(actor),
    orderBy: { createdAt: "desc" },
  });
}

export async function getCustomerEvent(actor: Actor, eventId: string) {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      ...eventScope(actor),
    },
  });
}

export async function loadGuestEvent(code: string) {
  const event = await prisma.event.findUnique({
    where: { uniqueCode: code },
    include: {
      customer: {
        select: { disabled: true, accessExpiresAt: true },
      },
    },
  });

  if (!event) {
    return null;
  }

  return {
    event,
    customerDisabled: event.customer.disabled,
    customerAccessExpiresAt: event.customer.accessExpiresAt,
  };
}

export function eventDateValue(eventDate: Date) {
  return calendarDateFromDb(eventDate);
}
