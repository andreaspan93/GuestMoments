"use client";

import { useActionState, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  changePasswordAction,
  forgotPasswordAction,
  loginAction,
  registerAction,
  resendVerificationAction,
  resetPasswordAction,
  updateAccountAction,
} from "@/lib/identity-actions";
import {
  passwordMeetsRules,
  type IdentityErrorCode,
  type IdentityFormState,
} from "@/lib/identity-schema";

const passwordPattern = "(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{10,128}";

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

function PasswordRules({ id }: { id: string }) {
  const t = useTranslations("auth");

  return (
    <p id={id} className="text-sm leading-6 text-foreground/80">
      {t("passwordRules")}
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
          autoComplete="given-name"
          placeholder={t("namePlaceholder")}
          required
          maxLength={120}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {t("surname")}
        <input
          className={fieldClassName}
          name="surname"
          autoComplete="family-name"
          placeholder={t("surnamePlaceholder")}
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
          aria-describedby="register-password-rules"
          required
          minLength={10}
          maxLength={128}
          pattern={passwordPattern}
          title={t("passwordRules")}
        />
      </label>
      <PasswordRules id="register-password-rules" />
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
          aria-describedby="reset-password-rules"
          required
          minLength={10}
          maxLength={128}
          pattern={passwordPattern}
          title={t("passwordRules")}
        />
      </label>
      <PasswordRules id="reset-password-rules" />
      <FormError state={state} />
      <SubmitButton label={t("submitReset")} pending={pending} />
    </form>
  );
}

export function AccountForm({
  name,
  surname,
  email,
}: {
  name: string;
  surname: string;
  email: string;
}) {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState(updateAccountAction, null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [passwordState, passwordAction, passwordPending] = useActionState(
    changePasswordAction,
    null,
  );
  const [fields, setFields] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [clientError, setClientError] = useState<IdentityErrorCode | null>(null);
  const [handledSuccess, setHandledSuccess] = useState(false);
  const passwordChanged = passwordState?.success === "passwordChanged";

  if (passwordChanged && !handledSuccess) {
    setHandledSuccess(true);
    setFields({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setClientError(null);
  } else if (!passwordChanged && handledSuccess) {
    setHandledSuccess(false);
  }

  function closePasswordForm() {
    setPasswordOpen(false);
    setFields({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setClientError(null);
  }

  function onPasswordSubmit(event: FormEvent<HTMLFormElement>) {
    if (!passwordMeetsRules(fields.newPassword)) {
      event.preventDefault();
      setClientError("weakPassword");
      return;
    }

    if (fields.newPassword !== fields.confirmPassword) {
      event.preventDefault();
      setClientError("passwordMismatch");
      return;
    }

    setClientError(null);
  }

  const passwordError = clientError
    ? ({ error: clientError } satisfies IdentityFormState)
    : passwordState;

  return (
    <div className="grid gap-8">
      <form action={action} className="grid gap-4">
        <label className="grid gap-2 text-sm font-medium">
          {t("name")}
          <input
            className={fieldClassName}
            name="name"
            autoComplete="given-name"
            placeholder={t("namePlaceholder")}
            required
            maxLength={120}
            defaultValue={name}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("surname")}
          <input
            className={fieldClassName}
            name="surname"
            autoComplete="family-name"
            placeholder={t("surnamePlaceholder")}
            maxLength={120}
            defaultValue={surname}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          {t("email")}
          <input
            className={`${fieldClassName} text-foreground/80`}
            type="email"
            autoComplete="email"
            readOnly
            aria-readonly="true"
            value={email}
          />
        </label>
        <FormError state={state} />
        {state?.success === "saved" ? (
          <p role="status" className="text-sm text-foreground/80">
            {t("accountSuccess")}
          </p>
        ) : null}
        <SubmitButton label={t("submitAccount")} pending={pending} />
      </form>

      {passwordOpen ? (
        <form action={passwordAction} onSubmit={onPasswordSubmit} className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            {t("currentPassword")}
            <input
              className={fieldClassName}
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={fields.currentPassword}
              onChange={(event) =>
                setFields((current) => ({
                  ...current,
                  currentPassword: event.target.value,
                }))
              }
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            {t("newPassword")}
            <input
              className={fieldClassName}
              name="newPassword"
              type="password"
              autoComplete="new-password"
              aria-describedby="account-password-rules"
              required
              minLength={10}
              maxLength={128}
              pattern={passwordPattern}
              title={t("passwordRules")}
              value={fields.newPassword}
              onChange={(event) =>
                setFields((current) => ({
                  ...current,
                  newPassword: event.target.value,
                }))
              }
            />
          </label>
          <PasswordRules id="account-password-rules" />
          <label className="grid gap-2 text-sm font-medium">
            {t("confirmPassword")}
            <input
              className={fieldClassName}
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={clientError === "passwordMismatch"}
              required
              maxLength={128}
              value={fields.confirmPassword}
              onChange={(event) =>
                setFields((current) => ({
                  ...current,
                  confirmPassword: event.target.value,
                }))
              }
            />
          </label>
          <FormError state={passwordError} />
          {passwordState?.success === "passwordChanged" && !clientError ? (
            <p role="status" className="text-sm text-foreground/80">
              {t("passwordChanged")}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <SubmitButton label={t("submitPassword")} pending={passwordPending} />
            <Button type="button" variant="outline" onClick={closePasswordForm}>
              {t("cancel")}
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" onClick={() => setPasswordOpen(true)}>
          {t("changePassword")}
        </Button>
      )}
    </div>
  );
}
