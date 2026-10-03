"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  updateAccountAction,
} from "@/lib/identity-actions";
import type { IdentityFormState } from "@/lib/identity-schema";

const fieldClassName =
  "h-10 rounded-full border border-border bg-background px-4 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FormError({ state }: { state: IdentityFormState }) {
  const t = useTranslations("auth");

  if (!state?.error) {
    return null;
  }

  return (
    <p role="alert" className="text-sm text-primary">
      {t(`errors.${state.error}`)}
    </p>
  );
}

function SubmitButton({ label, pending }: { label: string; pending: boolean }) {
  const t = useTranslations("auth");

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? t("pending") : label}
    </Button>
  );
}

export function RegisterForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(registerAction, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("name")}
        <input
          className={fieldClassName}
          name="name"
          autoComplete="name"
          required
          maxLength={120}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("email")}
        <input
          className={fieldClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("password")}
        <input
          className={fieldClassName}
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      <FormError state={state} />
      <SubmitButton label={t("submitRegister")} pending={pending} />
      <p className="text-sm text-foreground/80">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t("hasAccount")}
        </Link>
      </p>
    </form>
  );
}

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(loginAction, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("email")}
        <input
          className={fieldClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("password")}
        <input
          className={fieldClassName}
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
        />
      </label>
      <FormError state={state} />
      <SubmitButton label={t("submitLogin")} pending={pending} />
      <p className="flex flex-col gap-2 text-sm text-foreground/80">
        <Link
          href="/forgot-password"
          className="text-primary underline-offset-4 hover:underline"
        >
          {t("forgotLink")}
        </Link>
        <Link href="/register" className="text-primary underline-offset-4 hover:underline">
          {t("noAccount")}
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(forgotPasswordAction, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("email")}
        <input
          className={fieldClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </label>
      <FormError state={state} />
      {state?.success === "sent" ? (
        <p role="status" className="text-sm leading-6 text-foreground/80">
          {t("forgotSuccess")}
        </p>
      ) : null}
      <SubmitButton label={t("submitForgot")} pending={pending} />
      <p className="text-sm">
        <Link href="/login" className="text-primary underline-offset-4 hover:underline">
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}

export function ResendVerificationForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(resendVerificationAction, null);

  return (
    <form action={action} className="mt-4 grid gap-3">
      <FormError state={state} />
      {state?.success === "verificationSent" ? (
        <p role="status" className="text-sm leading-6 text-foreground/80">
          {t("verificationSent")}
        </p>
      ) : null}
      <SubmitButton label={t("resendVerification")} pending={pending} />
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(resetPasswordAction, null);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="token" value={token} />
      <label className="grid gap-2 text-sm font-medium">
        {t("newPassword")}
        <input
          className={fieldClassName}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </label>
      <FormError state={state} />
      <SubmitButton label={t("submitReset")} pending={pending} />
    </form>
  );
}

export function AccountForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(updateAccountAction, null);

  return (
    <form action={action} className="grid gap-4">
      <label className="grid gap-2 text-sm font-medium">
        {t("name")}
        <input
          className={fieldClassName}
          name="name"
          autoComplete="name"
          required
          maxLength={120}
          defaultValue={name}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("email")}
        <input
          className={fieldClassName}
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={email}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("currentPassword")}
        <input
          className={fieldClassName}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          maxLength={128}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("newPassword")}
        <input
          className={fieldClassName}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
        />
      </label>
      <p className="text-sm leading-6 text-foreground/80">{t("accountHint")}</p>
      <FormError state={state} />
      {state?.success === "saved" ? (
        <p role="status" className="text-sm text-foreground/80">
          {t("accountSuccess")}
        </p>
      ) : null}
      <SubmitButton label={t("submitAccount")} pending={pending} />
    </form>
  );
}
