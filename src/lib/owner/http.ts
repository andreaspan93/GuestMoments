import { z } from "zod";
import {
  createOwnerEvent,
  deleteOwnerEvent,
  getOwnerSettings,
  listOwnerCustomers,
  listOwnerEvents,
  platformCounts,
  activateCustomerAccess,
  deleteCustomerPermanently,
  getOwnerCustomer,
  setCustomerDisabled,
  updateOwnerEvent,
  updateOwnerSettings,
} from "@/lib/owner/service";
import {
  customerAccessSchema,
  customerActivationSchema,
  customerDeletionSchema,
  OwnerError,
  ownerCreateSchema,
  ownerSettingsSchema,
  ownerStatus,
  ownerUpdateSchema,
} from "@/lib/owner/schema";

type Actor = {
  id: string;
  role: string;
} | null;

export function ownerJson(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function ownerErrorResponse(error: unknown) {
  if (error instanceof OwnerError) {
    return ownerJson({ error: error.code }, ownerStatus(error.code));
  }

  if (error instanceof z.ZodError) {
    return ownerJson({ error: "invalid" }, 400);
  }

  throw error;
}

export async function respondOwner(work: () => Promise<unknown>, status = 200) {
  try {
    return ownerJson(await work(), status);
  } catch (error) {
    return ownerErrorResponse(error);
  }
}

export function readOwnerCustomers(actor: Actor) {
  return listOwnerCustomers(actor).then((customers) => ({ customers }));
}

export function readOwnerEvents(actor: Actor) {
  return listOwnerEvents(actor).then((events) => ({
    events: events.map((event) => ({
      id: event.id,
      name: event.name,
      customerId: event.customerId,
      retentionDays: event.retentionDays,
      maxStorageBytes: event.maxStorageBytes.toString(),
      expiresAt: event.expiresAt.toISOString(),
    })),
  }));
}

export function readOwnerCounts(actor: Actor) {
  return platformCounts(actor).then((counts) => ({
    customers: counts.customers,
    events: counts.events,
    media: counts.media,
    storageBytes: counts.storageBytes.toString(),
    storageLabel: counts.storageLabel,
  }));
}

export function readOwnerSettings(actor: Actor) {
  return getOwnerSettings(actor).then((settings) => ({
    defaultRetentionDays: settings.defaultRetentionDays,
    defaultMaxStorageBytes: settings.defaultMaxStorageBytes.toString(),
    maxPhotoBytes: settings.maxPhotoBytes.toString(),
    maxVideoBytes: settings.maxVideoBytes.toString(),
    maxEventsPerCustomer: settings.maxEventsPerCustomer,
  }));
}

function publicEvent(event: {
  id: string;
  customerId: string;
  retentionDays: number;
  maxStorageBytes: bigint;
  expiresAt: Date;
}) {
  return {
    id: event.id,
    customerId: event.customerId,
    retentionDays: event.retentionDays,
    maxStorageBytes: event.maxStorageBytes.toString(),
    expiresAt: event.expiresAt.toISOString(),
  };
}

export function postOwnerEvent(actor: Actor, body: unknown) {
  return createOwnerEvent(actor, ownerCreateSchema.parse(body)).then(publicEvent);
}

export function patchOwnerEvent(actor: Actor, eventId: string, body: unknown) {
  return updateOwnerEvent(actor, eventId, ownerUpdateSchema.parse(body)).then(publicEvent);
}

export function removeOwnerEvent(actor: Actor, eventId: string) {
  return deleteOwnerEvent(actor, eventId).then(() => ({ ok: true }));
}

export function patchOwnerSettings(actor: Actor, body: unknown) {
  return updateOwnerSettings(actor, ownerSettingsSchema.parse(body)).then((settings) => ({
    defaultRetentionDays: settings.defaultRetentionDays,
    defaultMaxStorageBytes: settings.defaultMaxStorageBytes.toString(),
    maxPhotoBytes: settings.maxPhotoBytes.toString(),
    maxVideoBytes: settings.maxVideoBytes.toString(),
    maxEventsPerCustomer: settings.maxEventsPerCustomer,
  }));
}

export function patchCustomerAccess(actor: Actor, userId: string, body: unknown) {
  const parsed = customerAccessSchema.parse(body);

  return setCustomerDisabled(actor, userId, parsed.disabled).then(() => ({ ok: true }));
}

export function postCustomerActivation(actor: Actor, userId: string, body: unknown) {
  return activateCustomerAccess(actor, userId, customerActivationSchema.parse(body)).then(
    (result) => ({
      ok: true,
      accessExpiresAt: result.accessExpiresAt.toISOString(),
    }),
  );
}

export function readOwnerCustomer(actor: Actor, userId: string) {
  return getOwnerCustomer(actor, userId);
}

export function removeOwnerCustomer(actor: Actor, userId: string, body: unknown) {
  const parsed = customerDeletionSchema.parse(body);

  return deleteCustomerPermanently(actor, userId, parsed.confirmEmail).then(() => ({
    ok: true,
  }));
}
