"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { calendarDateFromDb, formatCalendarDate } from "@/lib/events/expiry";
import { type LogoPlacement } from "@/lib/events/logo-placement";
import { posterTextSizes } from "@/lib/events/poster-title";
import {
  posterTypographySchema,
  type PosterTextSizes,
  type PosterTypography,
} from "@/lib/events/poster-typography";
import { sharePosterCopy } from "@/lib/events/qr-design";
import {
  createCustomerEvent,
  deleteCustomerEvent,
  updateCustomerEvent,
  updateLogoPlacement,
  updatePosterTypography,
} from "@/lib/events/service";
import { EventError, eventFormSchema } from "@/lib/events/schema";
import { redirect } from "@/i18n/navigation";
import { getRequestSession } from "@/lib/session";

export type EventFormState = {
  error?: "invalid" | "pastExpiry" | "inactive" | "eventLimit";
  success?: "saved";
  createdId?: string;
  savedId?: string;
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
    panelStyle: field(formData, "panelStyle") || "solid",
    accentColor: field(formData, "accentColor"),
    titleFont: field(formData, "titleFont"),
    guestFont: field(formData, "guestFont"),
    welcomeFont: field(formData, "welcomeFont"),
    titleBold: flag(formData, "titleBold"),
    guestBold: flag(formData, "guestBold"),
    welcomeBold: flag(formData, "welcomeBold"),
    logoSize: field(formData, "logoSize"),
    logoCorner: field(formData, "logoCorner"),
    privacyMode: field(formData, "privacyMode"),
    guestDownloadsEnabled: flag(formData, "guestDownloadsEnabled"),
    status: field(formData, "status"),
  };
}

function flag(formData: FormData, name: string) {
  const value = formData.get(name);
  return value === "true" || value === "on";
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

  revalidatePath("/[locale]/events", "page");
  return { createdId: event.id };
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
  return { savedId: eventId };
}

export type PosterTypographyResult =
  | { ok: true; typography: PosterTypography; sizes: PosterTextSizes }
  | { ok: false; error: "invalid" | "inactive" };

export async function updatePosterTypographyAction(
  eventId: string,
  input: PosterTypography,
): Promise<PosterTypographyResult> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor || typeof eventId !== "string" || eventId.length === 0) {
    return { ok: false, error: "invalid" };
  }

  const parsed = posterTypographySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: "invalid" };
  }

  try {
    const posterLocale = locale === "en" ? "en" : "el";
    const updated = await updatePosterTypography(actor, eventId, parsed.data);
    const copy = sharePosterCopy(posterLocale);

    revalidatePath("/[locale]/events/[id]/qr", "page");

    return {
      ok: true,
      typography: parsed.data,
      sizes: posterTextSizes(parsed.data, {
        name: updated.name,
        date: formatCalendarDate(calendarDateFromDb(updated.eventDate), posterLocale),
        kicker: copy.kicker,
        script: copy.script,
      }),
    };
  } catch (error) {
    if (error instanceof EventError && error.code === "inactive") {
      return { ok: false, error: "inactive" };
    }

    return { ok: false, error: "invalid" };
  }
}

export async function updateLogoPlacementAction(
  eventId: string,
  placement: LogoPlacement | null,
): Promise<{ ok: boolean }> {
  const locale = await getLocale();
  const actor = await actorOrRedirect(locale);

  if (!actor) {
    return { ok: false };
  }

  try {
    await updateLogoPlacement(actor, eventId, placement);
  } catch {
    return { ok: false };
  }

  revalidatePath("/[locale]/events/[id]", "page");
  revalidatePath("/e/[code]", "page");
  return { ok: true };
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
