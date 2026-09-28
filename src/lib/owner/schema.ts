import { z } from "zod";
import { eventFormSchema } from "@/lib/events/schema";

const retentionDays = z.coerce.number().int().min(0).max(3650);
const quotaMib = z.coerce.number().int().min(1).max(10_485_760);

const customerId = z.string().trim().min(1).max(128);

export const ownerCreateSchema = z.strictObject({
  ...eventFormSchema.shape,
  customerId,
});

export const ownerUpdateSchema = z.strictObject({
  ...eventFormSchema.shape,
  customerId,
  retentionDays,
  quotaMib,
});

export const ownerSettingsSchema = z.strictObject({
  defaultRetentionDays: retentionDays,
  defaultQuotaMib: quotaMib,
  maxPhotoMib: z.coerce.number().int().min(1).max(2048),
  maxVideoMib: z.coerce.number().int().min(1).max(10_240),
});

export const customerAccessSchema = z.strictObject({
  disabled: z.boolean(),
});

export type OwnerCreateValues = z.infer<typeof ownerCreateSchema>;
export type OwnerUpdateValues = z.infer<typeof ownerUpdateSchema>;
export type OwnerSettingsValues = z.infer<typeof ownerSettingsSchema>;

export type OwnerErrorCode = "unauthorized" | "forbidden" | "invalid" | "notFound" | "pastExpiry";

export class OwnerError extends Error {
  readonly code: OwnerErrorCode;

  constructor(code: OwnerErrorCode) {
    super(code);
    this.code = code;
  }
}

export function ownerStatus(code: OwnerErrorCode) {
  if (code === "unauthorized") {
    return 401;
  }

  if (code === "forbidden") {
    return 403;
  }

  if (code === "notFound") {
    return 404;
  }

  return 400;
}
