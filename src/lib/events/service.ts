import { randomUUID } from "node:crypto";
import { customerHasServiceAccess } from "@/lib/access";
import { eventScope } from "@/lib/events/access";
import { createEventCode } from "@/lib/events/code";
import { PLATFORM_SETTINGS_ID } from "@/lib/events/defaults";
import {
  calendarDateFromDb,
  calendarDateToDb,
  expiresAtFor,
  isExpiryPast,
} from "@/lib/events/expiry";
import { EventError, type EventFormValues } from "@/lib/events/schema";
import { prisma } from "@/lib/prisma";
import { getStorage } from "@/lib/storage";
import type { IStorageService } from "@/lib/storage/types";
import { eventStoragePrefix } from "@/lib/uploads/policy";

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
  accentColor: string;
  status: string;
  privacyMode: string;
  retentionDays: number;
  maxStorageBytes: bigint;
  expiresAt: Date;
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
    throw new EventError("inactive");
  }
}

export async function createCustomerEvent(
  actor: Actor,
  input: EventFormValues,
  now = new Date(),
  options?: { enforceServiceAccess?: boolean },
) {
  await ensureCustomerService(actor, now, options?.enforceServiceAccess !== false);
  const settings = await platformSettings();
  const expiresAt = expiresAtFor(input.eventDate, settings.defaultRetentionDays);

  if (isExpiryPast(expiresAt, now)) {
    throw new EventError("pastExpiry");
  }

  return insertEvent({
    customerId: actor.id,
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
    retentionDays: settings.defaultRetentionDays,
    maxStorageBytes: settings.defaultMaxStorageBytes,
    expiresAt,
  });
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
    throw new EventError("notFound");
  }

  const expiresAt = expiresAtFor(input.eventDate, existing.retentionDays);

  if (isExpiryPast(expiresAt, now)) {
    throw new EventError("pastExpiry");
  }

  return prisma.event.update({
    where: { id: existing.id },
    data: {
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
      expiresAt,
    },
  });
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
    select: { id: true },
  });

  if (!existing) {
    throw new EventError("notFound");
  }

  await (storage ?? getStorage()).deletePrefix(eventStoragePrefix(existing.id));
  await prisma.event.delete({
    where: { id: existing.id },
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
        select: { disabled: true },
      },
    },
  });

  if (!event) {
    return null;
  }

  return {
    event,
    customerDisabled: event.customer.disabled,
  };
}

export function eventDateValue(eventDate: Date) {
  return calendarDateFromDb(eventDate);
}
