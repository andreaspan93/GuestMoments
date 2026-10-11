import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { applyAccountUpdateFromInput } from "./account";
import { auth } from "./auth";
import { verificationDeliveries } from "./email";
import { IdentityError } from "./identity-schema";
import { prisma } from "./prisma";
import { getActiveSession } from "./session";

const createdEmails: string[] = [];

function emailAddress() {
  const email = `phase2-${randomUUID()}@example.com`;
  createdEmails.push(email);
  return email;
}

function cookieHeaderFrom(response: Response) {
  const cookies = response.headers.getSetCookie();
  return new Headers({
    cookie: cookies.map((item) => item.split(";")[0]).join("; "),
  });
}

async function signUp(body: Record<string, unknown>) {
  return auth.api.signUpEmail({
    body: body as never,
  });
}

describe("identity", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { in: createdEmails } },
    });
    await prisma.$disconnect();
  });

  it("stores a customer and the registration language, ignoring role and disabled", async () => {
    const email = emailAddress();

    await signUp({
      name: "English",
      surname: "Guest",
      email,
      password: "Password123!",
      preferredLocale: "en",
      role: "OWNER",
      disabled: true,
      accessStatus: "ACTIVE",
    });

    const user = await prisma.user.findUnique({ where: { email } });

    expect(user?.name).toBe("English");
    expect(user?.surname).toBe("Guest");
    expect(user?.role).toBe("CUSTOMER");
    expect(user?.disabled).toBe(false);
    expect(user?.emailVerified).toBe(false);
    expect(user?.accessStatus).toBe("PENDING");
    expect(user?.accessExpiresAt).toBeNull();
    expect(user?.preferredLocale).toBe("en");
  });

  it("falls back to Greek when the registration locale is not supported", async () => {
    const email = emailAddress();

    await signUp({
      name: "Greek Guest",
      email,
      password: "Password123!",
      preferredLocale: "fr",
    });

    const user = await prisma.user.findUnique({ where: { email } });

    expect(user?.preferredLocale).toBe("el");
    expect(user?.surname).toBe("");
    expect(user?.role).toBe("CUSTOMER");
  });

  it("does not let an account update set role or disabled", async () => {
    const email = emailAddress();
    const response = await auth.api.signUpEmail({
      body: {
        name: "Account User",
        email,
        password: "Password123!",
        preferredLocale: "el",
      },
      asResponse: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await expect(
      applyAccountUpdateFromInput(user.id, {
        name: "Hacker",
        email,
        currentPassword: "password123",
        role: "OWNER",
        disabled: true,
      }),
    ).rejects.toBeInstanceOf(IdentityError);

    await expect(
      auth.api.updateUser({
        body: {
          name: "Still Customer",
          role: "OWNER",
          disabled: true,
        } as never,
        headers: cookieHeaderFrom(response),
      }),
    ).rejects.toMatchObject({
      body: { code: "FIELD_NOT_ALLOWED" },
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });

    expect(stored.name).toBe("Account User");
    expect(stored.role).toBe("CUSTOMER");
    expect(stored.disabled).toBe(false);
  });

  it("revokes sessions when a user is disabled and blocks the next login", async () => {
    const email = emailAddress();
    const response = await auth.api.signUpEmail({
      body: {
        name: "Disabled User",
        email,
        password: "Password123!",
        preferredLocale: "el",
      },
      asResponse: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const headers = cookieHeaderFrom(response);

    await prisma.user.update({
      where: { id: user.id },
      data: { disabled: true },
    });

    await expect(getActiveSession(headers)).resolves.toBeNull();
    await expect(
      prisma.session.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
    await expect(
      auth.api.signInEmail({
        body: { email, password: "Password123!" },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.session.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);
  });

  it("sends a verification link and verifies the email without activating service access", async () => {
    verificationDeliveries.length = 0;
    const email = emailAddress();
    await signUp({
      name: "Verify User",
      email,
      password: "Password123!",
      preferredLocale: "en",
    });
    const sent = verificationDeliveries.filter((item) => item.to === email);
    expect(sent.length).toBeGreaterThan(0);
    expect(sent[0]?.locale).toBe("en");
    expect(sent[0]?.url).toContain("/api/auth/verify-email");
    expect(sent[0]?.url).not.toContain(email);
    const token = new URL(sent[0]!.url).searchParams.get("token");
    expect(token).toBeTruthy();

    verificationDeliveries.length = 0;
    const signedIn = await auth.api.signInEmail({
      body: { email, password: "Password123!" },
      asResponse: true,
    });
    await auth.api.sendVerificationEmail({
      body: {
        email,
        callbackURL: "http://localhost:3000/account",
      },
      headers: cookieHeaderFrom(signedIn),
    });
    const resent = verificationDeliveries.filter((item) => item.to === email);
    expect(resent.length).toBeGreaterThan(0);

    await auth.api.verifyEmail({
      query: { token: new URL(resent[0]!.url).searchParams.get("token")! },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.emailVerified).toBe(true);
    expect(user.accessStatus).toBe("PENDING");
  });

  it("resets the password and revokes existing sessions", async () => {
    const email = emailAddress();
    await signUp({
      name: "Reset User",
      email,
      password: "Password123!",
      preferredLocale: "en",
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    await auth.api.requestPasswordReset({
      body: {
        email,
        redirectTo: "http://localhost:3000/en/reset-password",
      },
    });

    const verification = await prisma.verification.findFirst({
      where: {
        value: user.id,
        identifier: { startsWith: "reset-password:" },
      },
    });
    const token = verification?.identifier.replace("reset-password:", "");

    expect(token).toBeTruthy();

    await auth.api.resetPassword({
      body: {
        token,
        newPassword: "Newpassword1!",
      },
    });

    await expect(
      prisma.session.count({ where: { userId: user.id } }),
    ).resolves.toBe(0);

    const signedIn = await auth.api.signInEmail({
      body: { email, password: "Newpassword1!" },
      asResponse: true,
    });

    expect(signedIn.status).toBe(200);
  });

  it("saves name and surname independently and keeps a legacy empty surname usable", async () => {
    const email = emailAddress();
    const response = await auth.api.signUpEmail({
      body: {
        name: "Account User",
        email,
        password: "Password123!",
        preferredLocale: "el",
      },
      asResponse: true,
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const headers = cookieHeaderFrom(response);

    await prisma.user.update({
      where: { id: user.id },
      data: { name: "Legacy Name", surname: "" },
    });

    const legacy = await getActiveSession(headers);
    expect(legacy?.user.name).toBe("Legacy Name");
    expect(legacy?.user.surname).toBe("");

    await applyAccountUpdateFromInput(user.id, {
      name: "Mary",
      surname: "Smith",
    });
    await applyAccountUpdateFromInput(user.id, {
      name: "Mary",
      surname: "Jones",
    });
    await applyAccountUpdateFromInput(user.id, {
      name: "Helen",
      surname: "Jones",
    });

    const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(stored.name).toBe("Helen");
    expect(stored.surname).toBe("Jones");
    expect(stored.email).toBe(email);

    const session = await getActiveSession(headers);
    expect(session?.user.name).toBe("Helen");
    expect(session?.user.surname).toBe("Jones");
    expect(session?.user.email).toBe(email);
  });

  it("rejects a weak signup password and a password change with the wrong current password", async () => {
    const email = emailAddress();

    await expect(
      signUp({
        name: "Weak",
        surname: "Password",
        email,
        password: "password123",
        preferredLocale: "el",
      }),
    ).rejects.toMatchObject({
      body: { code: "PASSWORD_TOO_SHORT" },
    });

    const response = await auth.api.signUpEmail({
      body: {
        name: "Password",
        surname: "Change",
        email,
        password: "Password123!",
        preferredLocale: "el",
      },
      asResponse: true,
    });
    const headers = cookieHeaderFrom(response);

    await expect(
      auth.api.changePassword({
        body: {
          currentPassword: "wrong-password",
          newPassword: "Newpassword1!",
          revokeOtherSessions: true,
        },
        headers,
      }),
    ).rejects.toMatchObject({
      body: { code: "INVALID_PASSWORD" },
    });

    await auth.api.changePassword({
      body: {
        currentPassword: "Password123!",
        newPassword: "Newpassword1!",
        revokeOtherSessions: true,
      },
      headers,
    });

    const signedIn = await auth.api.signInEmail({
      body: { email, password: "Newpassword1!" },
      asResponse: true,
    });

    expect(signedIn.status).toBe(200);
  });
});
