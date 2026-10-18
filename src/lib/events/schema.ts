import { z } from "zod";
import { defaultEventFont, eventFontIds, logoCorners, logoSizes, panelStyles } from "./appearance";
import { isCalendarDate } from "./expiry";

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .transform((value) => value.toLowerCase());

export const eventFormSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  eventDate: z.string().refine(isCalendarDate),
  welcomeMessageEl: z.string().trim().max(4000),
  welcomeMessageEn: z.string().trim().max(4000),
  uploadInstructionsEl: z.string().trim().max(4000),
  uploadInstructionsEn: z.string().trim().max(4000),
  backgroundColor: hexColor,
  panelStyle: z.enum(panelStyles).default("solid"),
  accentColor: hexColor,
  titleFont: z.enum(eventFontIds),
  guestFont: z.enum(eventFontIds),
  welcomeFont: z.enum(eventFontIds).default(defaultEventFont),
  titleBold: z.boolean().default(true),
  guestBold: z.boolean().default(false),
  welcomeBold: z.boolean().default(false),
  logoSize: z.enum(logoSizes),
  logoCorner: z.enum(logoCorners),
  privacyMode: z.enum(["OWN_UPLOADS", "FULL_GALLERY"]),
  guestDownloadsEnabled: z.boolean().default(true),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

export class EventError extends Error {
  readonly code: "invalid" | "pastExpiry" | "notFound" | "inactive" | "eventLimit";

  constructor(code: "invalid" | "pastExpiry" | "notFound" | "inactive" | "eventLimit") {
    super(code);
    this.code = code;
  }
}
