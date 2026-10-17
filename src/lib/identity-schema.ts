import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
const personNameSchema = z.string().trim().min(1).max(120);

export function passwordMeetsRules(password: string) {
  return (
    password.length >= 10 &&
    password.length <= 128 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

const newPasswordSchema = z.string().refine(passwordMeetsRules, { message: "weak" });

export const registerSchema = z.strictObject({
  name: personNameSchema,
  surname: personNameSchema,
  email: emailSchema,
  password: newPasswordSchema,
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
  newPassword: newPasswordSchema,
});

export const accountUpdateSchema = z.strictObject({
  name: personNameSchema,
  surname: z.string().trim().max(120),
});

export const deleteAccountSchema = z.strictObject({
  confirmEmail: emailSchema,
  currentPassword: z.string().min(1).max(128),
});

export const changePasswordSchema = z
  .strictObject({
    currentPassword: z.string().min(1).max(128),
    newPassword: newPasswordSchema,
    confirmPassword: z.string().max(128),
  })
  .superRefine((value, context) => {
    if (value.newPassword !== value.confirmPassword) {
      context.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "mismatch",
      });
    }
  });

export type IdentityErrorCode =
  | "invalid"
  | "emailTaken"
  | "invalidCredentials"
  | "invalidPassword"
  | "weakPassword"
  | "passwordMismatch"
  | "noPassword"
  | "passwordRequired"
  | "resetInvalid"
  | "sessionExpired"
  | "confirmEmail"
  | "forbidden"
  | "storage";

export type IdentityFormState = {
  error?: IdentityErrorCode;
  success?: "sent" | "saved" | "verificationSent" | "passwordChanged";
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
