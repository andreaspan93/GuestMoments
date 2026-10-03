"use server";

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { applyAccountUpdate } from "@/lib/account";
import { auth } from "@/lib/auth";
import {
  IdentityError,
  accountUpdateSchema,
  forgotPasswordSchema,
  loginSchema,
  preferredLocaleFromPage,
  registerSchema,
  resetPasswordSchema,
  type IdentityErrorCode,
  type IdentityFormState,
} from "@/lib/identity-schema";
import { getRequestSession } from "@/lib/session";
import { redirect } from "@/i18n/navigation";

function appOrigin() {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

function formError(error: unknown): IdentityFormState {
  if (error instanceof IdentityError) {
    return { error: error.code };
  }

  const code =
    error instanceof APIError ? String(error.body?.code ?? "") : "";

  const mapped: Record<string, IdentityErrorCode> = {
    USER_ALREADY_EXISTS: "emailTaken",
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "emailTaken",
    INVALID_EMAIL_OR_PASSWORD: "invalidCredentials",
    INVALID_PASSWORD: "invalidPassword",
    INVALID_TOKEN: "resetInvalid",
    TOKEN_EXPIRED: "resetInvalid",
    SESSION_NOT_FRESH: "sessionExpired",
    SESSION_EXPIRED: "sessionExpired",
  };

  return { error: mapped[code] ?? "invalid" };
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function registerAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const parsed = registerSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    const prefix = locale === "en" ? "/en" : "";

    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: parsed.data.password,
        preferredLocale: preferredLocaleFromPage(locale),
        callbackURL: `${appOrigin()}${prefix}/account?verified=1`,
      },
      headers: await headers(),
    });
  } catch (error) {
    return formError(error);
  }

  redirect({ href: "/account", locale });
  return null;
}

export async function loginAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const parsed = loginSchema.safeParse({
    email: field(formData, "email"),
    password: field(formData, "password"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email: parsed.data.email,
        password: parsed.data.password,
      },
      headers: await headers(),
    });
  } catch (error) {
    return formError(error);
  }

  redirect({ href: "/account", locale });
  return null;
}

export async function resendVerificationAction(
  state: IdentityFormState,
): Promise<IdentityFormState> {
  void state;
  const locale = await getLocale();
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return { error: "sessionExpired" };
  }

  if (session.user.role === "OWNER" || session.user.emailVerified) {
    return { success: "verificationSent" };
  }

  const prefix = locale === "en" ? "/en" : "";

  try {
    await auth.api.sendVerificationEmail({
      body: {
        email: session.user.email,
        callbackURL: `${appOrigin()}${prefix}/account?verified=1`,
      },
      headers: await headers(),
    });
  } catch (error) {
    return formError(error);
  }

  return { success: "verificationSent" };
}

export async function logoutAction() {
  const locale = await getLocale();

  await auth.api.signOut({
    headers: await headers(),
  });

  redirect({ href: "/", locale });
}

export async function forgotPasswordAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const parsed = forgotPasswordSchema.safeParse({
    email: field(formData, "email"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const prefix = locale === "en" ? "/en" : "";

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: `${appOrigin()}${prefix}/reset-password`,
      },
      headers: await headers(),
    });
  } catch (error) {
    console.error(error);
  }

  return { success: "sent" };
}

export async function resetPasswordAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const parsed = resetPasswordSchema.safeParse({
    token: field(formData, "token"),
    newPassword: field(formData, "newPassword"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    await auth.api.resetPassword({
      body: {
        newPassword: parsed.data.newPassword,
        token: parsed.data.token,
      },
      headers: await headers(),
    });
  } catch (error) {
    return formError(error);
  }

  redirect({ href: "/login?reset=1", locale });
  return null;
}

export async function updateAccountAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return { error: "sessionExpired" };
  }

  const parsed = accountUpdateSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    currentPassword: field(formData, "currentPassword"),
    newPassword: field(formData, "newPassword"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  const emailChanged = parsed.data.email !== session.user.email;
  const passwordChanged = parsed.data.newPassword.length > 0;

  if ((emailChanged || passwordChanged) && !parsed.data.currentPassword) {
    return { error: "passwordRequired" };
  }

  try {
    if (parsed.data.name !== session.user.name || emailChanged) {
      await applyAccountUpdate({
        userId: session.user.id,
        name: parsed.data.name,
        email: parsed.data.email,
        currentPassword: parsed.data.currentPassword,
      });
    }

    if (passwordChanged) {
      await auth.api.changePassword({
        body: {
          currentPassword: parsed.data.currentPassword,
          newPassword: parsed.data.newPassword,
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    }
  } catch (error) {
    return formError(error);
  }

  return { success: "saved" };
}
