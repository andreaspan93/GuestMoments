"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import {
  createCustomerEvent,
  deleteCustomerEvent,
  updateCustomerEvent,
} from "@/lib/events/service";
import { EventError, eventFormSchema } from "@/lib/events/schema";
import { redirect } from "@/i18n/navigation";
import { getRequestSession } from "@/lib/session";

export type EventFormState = {
  error?: "invalid" | "pastExpiry" | "inactive" | "eventLimit";
  success?: "saved";
} | null;

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function readEventForm(formData: FormData) {
  return {
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

function formError(error: unknown): EventFormState {
  if (error instanceof EventError && error.code === "pastExpiry") {
    return { error: "pastExpiry" };
  }

  if (error instanceof EventError && error.code === "inactive") {
    return { error: "inactive" };
  }

  if (error instanceof EventError && error.code === "eventLimit") {
    return { error: "eventLimit" };
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

export async function createEventAction(
  _state: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = eventFormSchema.safeParse(readEventForm(formData));

  if (!parsed.success) {
    return { error: "invalid" };
  }

  let event;

  try {
    event = await createCustomerEvent(actor, parsed.data);
  } catch (error) {
    return formError(error);
  }

  redirect({ href: `/events/${event.id}`, locale });
  return null;
}

export async function updateEventAction(
  eventId: string,
  _state: EventFormState,
  formData: FormData,
): Promise<EventFormState> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { error: "invalid" };
  }

  const parsed = eventFormSchema.safeParse(readEventForm(formData));

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await updateCustomerEvent(actor, eventId, parsed.data);
  } catch (error) {
    return formError(error);
  }

  revalidatePath("/[locale]/events/[id]", "page");
  revalidatePath("/[locale]/events", "page");
  return { success: "saved" };
}

export async function deleteEventAction(eventId: string) {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return;
  }

  try {
    await deleteCustomerEvent(actor, eventId);
  } catch (error) {
    if (!(error instanceof EventError)) {
      throw error;
    }
  }

  redirect({ href: "/events", locale });
}
