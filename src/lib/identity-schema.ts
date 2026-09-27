import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.strictObject({
  email: emailSchema,
});

export const resetPasswordSchema = z.strictObject({
  token: z.string().trim().min(1).max(256),
  newPassword: passwordSchema,
});

export const accountUpdateSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(120),
    email: emailSchema,
    currentPassword: z.string().max(128).optional().default(""),
    newPassword: z.string().max(128).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.newPassword.length > 0 && value.newPassword.length < 8) {
      context.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "short",
      });
    }
  });

export type IdentityErrorCode =
  | "invalid"
  | "emailTaken"
  | "invalidCredentials"
  | "invalidPassword"
  | "passwordRequired"
  | "resetInvalid"
  | "sessionExpired";

export type IdentityFormState = {
  error?: IdentityErrorCode;
  success?: "sent" | "saved";
} | null;

export function preferredLocaleFromPage(locale: string): "el" | "en" {
  return locale === "en" ? "en" : "el";
}

export class IdentityError extends Error {
  readonly code: IdentityErrorCode;

  constructor(code: IdentityErrorCode) {
    super(code);
    this.code = code;
  }
}
