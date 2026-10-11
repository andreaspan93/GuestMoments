"use server";

import { APIError } from "better-auth";
import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { applyAccountUpdate } from "@/lib/account";
import { auth } from "@/lib/auth";
import {
  IdentityError,
  accountUpdateSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  preferredLocaleFromPage,
  registerSchema,
  resetPasswordSchema,
  type IdentityErrorCode,
  type IdentityFormState,
} from "@/lib/identity-schema";
import { actorTypeForRole, safeRequestId } from "@/lib/logging/catalog";
import { recordApplicationLog, recordUnexpectedError } from "@/lib/logging/logger";
import { prisma } from "@/lib/prisma";
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
    PASSWORD_TOO_SHORT: "weakPassword",
    PASSWORD_TOO_LONG: "weakPassword",
    CREDENTIAL_ACCOUNT_NOT_FOUND: "noPassword",
    INVALID_TOKEN: "resetInvalid",
    TOKEN_EXPIRED: "resetInvalid",
    SESSION_NOT_FRESH: "sessionExpired",
    SESSION_EXPIRED: "sessionExpired",
  };

  return { error: mapped[code] ?? "invalid" };
}

async function requestCorrelationId() {
  try {
    return safeRequestId((await headers()).get("x-request-id"));
  } catch {
    return null;
  }
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
    surname: field(formData, "surname"),
    email: field(formData, "email"),
    password: field(formData, "password"),
  });

  if (!parsed.success) {
    const weakPassword = parsed.error.issues.some(
      (issue) => issue.path[0] === "password",
    );
    return { error: weakPassword ? "weakPassword" : "invalid" };
  }

  try {
    const prefix = locale === "en" ? "/en" : "";

    await auth.api.signUpEmail({
      body: {
        name: parsed.data.name,
        surname: parsed.data.surname,
        email: parsed.data.email,
        password: parsed.data.password,
        preferredLocale: preferredLocaleFromPage(locale),
        callbackURL: `${appOrigin()}${prefix}/account?verified=1`,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = error instanceof APIError ? String(error.body?.code ?? "") : "";

    if (
      code === "USER_ALREADY_EXISTS" ||
      code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" ||
      code === "PASSWORD_TOO_SHORT" ||
      code === "PASSWORD_TOO_LONG"
    ) {
      await recordApplicationLog({
        eventType: "account.created",
        actorType: "anonymous",
        result: "failure",
        requestId: await requestCorrelationId(),
        metadata: {
          reason:
            code === "PASSWORD_TOO_SHORT" || code === "PASSWORD_TOO_LONG"
              ? "weak_password"
              : "email_taken",
        },
      });
    } else {
      await recordUnexpectedError();
    }

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
    const user = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      select: { id: true, role: true },
    });

    await recordApplicationLog({
      eventType: "auth.login.succeeded",
      actorType: actorTypeForRole(user?.role),
      actorId: user?.id,
      targetType: "user",
      targetId: user?.id,
      result: "success",
      requestId: await requestCorrelationId(),
    });
  } catch (error) {
    await recordApplicationLog({
      eventType: "auth.login.failed",
      actorType: "anonymous",
      result: "failure",
      requestId: await requestCorrelationId(),
      metadata: { reason: "invalid_credentials" },
    });
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
  } catch {
    await recordUnexpectedError();
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
    const weakPassword = parsed.error.issues.some(
      (issue) => issue.path[0] === "newPassword",
    );
    return { error: weakPassword ? "weakPassword" : "invalid" };
  }

  let resetUserId: string | null = null;

  try {
    const verification = await prisma.verification.findFirst({
      where: { identifier: `reset-password:${parsed.data.token}` },
      select: { value: true },
    });
    resetUserId = verification?.value ?? null;

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

  await recordApplicationLog({
    eventType: "auth.password.reset",
    actorType: "customer",
    actorId: resetUserId,
    targetType: "user",
    targetId: resetUserId,
    result: "success",
    requestId: await requestCorrelationId(),
  });

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
    surname: field(formData, "surname"),
  });

  if (!parsed.success) {
    return { error: "invalid" };
  }

  try {
    if (
      parsed.data.name !== session.user.name ||
      parsed.data.surname !== session.user.surname
    ) {
      await applyAccountUpdate({
        userId: session.user.id,
        name: parsed.data.name,
        surname: parsed.data.surname,
      });
      const fields = [
        ...(parsed.data.name !== session.user.name ? ["name" as const] : []),
        ...(parsed.data.surname !== session.user.surname ? ["surname" as const] : []),
      ];

      await recordApplicationLog({
        eventType: "account.updated",
        actorType: actorTypeForRole(session.user.role),
        actorId: session.user.id,
        targetType: "user",
        targetId: session.user.id,
        result: "success",
        requestId: await requestCorrelationId(),
        metadata: { fields },
      });
    }
  } catch (error) {
    return formError(error);
  }

  return { success: "saved" };
}

export async function changePasswordAction(
  _state: IdentityFormState,
  formData: FormData,
): Promise<IdentityFormState> {
  const locale = await getLocale();
  const session = await getRequestSession();

  if (!session) {
    redirect({ href: "/login", locale });
    return { error: "sessionExpired" };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: field(formData, "currentPassword"),
    newPassword: field(formData, "newPassword"),
    confirmPassword: field(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    if (parsed.error.issues.some((issue) => issue.path[0] === "newPassword")) {
      return { error: "weakPassword" };
    }

    if (
      parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword")
    ) {
      return { error: "passwordMismatch" };
    }

    return { error: "invalid" };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (error) {
    const code = error instanceof APIError ? String(error.body?.code ?? "") : "";

    await recordApplicationLog({
      eventType: "auth.password.changed",
      actorType: actorTypeForRole(session.user.role),
      actorId: session.user.id,
      targetType: "user",
      targetId: session.user.id,
      result: "failure",
      requestId: await requestCorrelationId(),
      metadata: {
        reason: code === "INVALID_PASSWORD" ? "invalid_password" : "unexpected",
      },
    });
    return formError(error);
  }

  await recordApplicationLog({
    eventType: "auth.password.changed",
    actorType: actorTypeForRole(session.user.role),
    actorId: session.user.id,
    targetType: "user",
    targetId: session.user.id,
    result: "success",
    requestId: await requestCorrelationId(),
  });

  return { success: "passwordChanged" };
}
