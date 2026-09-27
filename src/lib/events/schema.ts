import { z } from "zod";
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
  accentColor: hexColor,
  privacyMode: z.enum(["OWN_UPLOADS", "FULL_GALLERY"]),
  status: z.enum(["ACTIVE", "DISABLED"]),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

export class EventError extends Error {
  readonly code: "invalid" | "pastExpiry" | "notFound";

  constructor(code: "invalid" | "pastExpiry" | "notFound") {
    super(code);
    this.code = code;
  }
}
