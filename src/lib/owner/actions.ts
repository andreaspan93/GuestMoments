"use server";

import { forbidden } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import {
  activateCustomerAccess,
  createOwnerEvent,
  deleteCustomerPermanently,
  deleteOwnerEvent,
  setCustomerDisabled,
  updateOwnerEvent,
  updateOwnerSettings,
} from "@/lib/owner/service";
import {
  OwnerError,
  customerActivationSchema,
  customerDeletionSchema,
  ownerCreateSchema,
  ownerSettingsSchema,
  ownerUpdateSchema,
} from "@/lib/owner/schema";
import { getRequestSession } from "@/lib/session";

export type OwnerFormState = {
  error?: "invalid" | "pastExpiry" | "notFound" | "confirmEmail" | "storage";
  success?: "saved" | "deleted";
} | null;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readEventFields(formData: FormData) {
  return {
    customerId: field(formData, "customerId"),
    name: field(formData, "name"),
    eventDate: field(formData, "eventDate"),
    welcomeMessageEl: field(formData, "welcomeMessageEl"),
    welcomeMessageEn: field(formData, "welcomeMessageEn"),
    uploadInstructionsEl: field(formData, "uploadInstructionsEl"),
    uploadInstructionsEn: field(formData, "uploadInstructionsEn"),
    backgroundColor: field(formData, "backgroundColor"),
    accentColor: field(formData, "accentColor"),
    privacyMode: field(formData, "privacyMode"),
    status: field(formData, "status"),
  };
}

function formError(error: unknown): OwnerFormState {
  if (error instanceof OwnerError && error.code === "forbidden") {
    forbidden();
  }

  if (error instanceof OwnerError && error.code === "pastExpiry") {
    return { error: "pastExpiry" };
  }

  if (error instanceof OwnerError && error.code === "notFound") {
    return { error: "notFound" };
  }

  if (error instanceof OwnerError && error.code === "confirmEmail") {
    return { error: "confirmEmail" };
  }

  if (error instanceof OwnerError && error.code === "storage") {
    return { error: "storage" };
  }

  return { error: "invalid" };
}

async function actorOrRedirect(locale: string) {
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return null;
  }

  return session.user;
}

export async function createOwnerEventAction(
  _state: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = ownerCreateSchema.safeParse(readEventFields(formData));

  if (!parsed.success) {
    return { error: "invalid" };
  }

  let event;

  try {
    event = await createOwnerEvent(actor, parsed.data);
  } catch (error) {
    return formError(error);
  }

  redirect({ href: `/owner/events/${event.id}`, locale });
  return null;
}

export async function updateOwnerEventAction(
  eventId: string,
  _state: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = ownerUpdateSchema.safeParse({
    ...readEventFields(formData),
    retentionDays: field(formData, "retentionDays"),
    quotaMib: field(formData, "quotaMib"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await updateOwnerEvent(actor, eventId, parsed.data);
  } catch (error) {
    return formError(error);
  }

  revalidatePath("/[locale]/owner/events/[id]", "page");
  revalidatePath("/[locale]/owner/events", "page");
  revalidatePath("/[locale]/events", "page");
  return { success: "saved" };
}

export async function updateOwnerSettingsAction(
  _state: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = ownerSettingsSchema.safeParse({
    defaultRetentionDays: field(formData, "defaultRetentionDays"),
    defaultQuotaMib: field(formData, "defaultQuotaMib"),
    maxPhotoMib: field(formData, "maxPhotoMib"),
    maxVideoMib: field(formData, "maxVideoMib"),
    maxEventsPerCustomer: field(formData, "maxEventsPerCustomer"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await updateOwnerSettings(actor, parsed.data);
  } catch (error) {
    return formError(error);
  }

  revalidatePath("/[locale]/owner/settings", "page");
  return { success: "saved" };
}

export async function setCustomerAccessAction(userId: string, disabled: boolean) {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return;
  }

  try {
    await setCustomerDisabled(actor, userId, disabled);
  } catch (error) {
    if (error instanceof OwnerError && error.code === "forbidden") {
      forbidden();
    }

    return;
  }

  revalidatePath("/[locale]/owner/customers", "page");
  revalidatePath("/[locale]/owner/customers/[id]", "page");
}

export async function activateCustomerAction(
  userId: string,
  _state: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = customerActivationSchema.safeParse({
    duration: field(formData, "duration"),
    expiresOn: field(formData, "expiresOn"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await activateCustomerAccess(actor, userId, parsed.data);
  } catch (error) {
    return formError(error);
  }

  revalidatePath("/[locale]/owner/customers", "page");
  revalidatePath("/[locale]/owner/customers/[id]", "page");
  return { success: "saved" };
}

export async function deleteCustomerAction(
  userId: string,
  _state: OwnerFormState,
  formData: FormData,
): Promise<OwnerFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = customerDeletionSchema.safeParse({
    confirmEmail: field(formData, "confirmEmail"),
  });

  if (!parsed.success) {
    return { error: "confirmEmail" };
  }

  try {
    await deleteCustomerPermanently(actor, userId, parsed.data.confirmEmail);
  } catch (error) {
    return formError(error);
  }

  revalidatePath("/[locale]/owner/customers", "page");
  redirect({ href: "/owner/customers?deleted=1", locale });
  return null;
}

export async function deleteOwnerEventAction(eventId: string) {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return;
  }

  try {
    await deleteOwnerEvent(actor, eventId);
  } catch (error) {
    if (error instanceof OwnerError && error.code === "forbidden") {
      forbidden();
    }
  }

  redirect({ href: "/owner/events", locale });
}
