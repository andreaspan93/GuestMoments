import { APIError, betterAuth } from "better-auth";
import { lockExpiredCustomer } from "@/lib/access";
import { createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { passwordMeetsRules } from "@/lib/identity-schema";
import { recordApplicationLog } from "@/lib/logging/logger";
import { prisma } from "@/lib/prisma";

function newPasswordFromRequest(path: string, body: unknown) {
  if (!body || typeof body !== "object") {
    return undefined;
  }

  const record = body as { password?: unknown; newPassword?: unknown };

  if (path.includes("sign-up")) {
    return record.password;
  }

  if (path.includes("change-password") || path.includes("reset-password")) {
    return record.newPassword;
  }

  return undefined;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail({
        to: user.email,
        url,
        locale:
          (user as { preferredLocale?: string }).preferredLocale === "en"
            ? "en"
            : "el",
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({
        to: user.email,
        url,
        locale:
          (user as { preferredLocale?: string }).preferredLocale === "en"
            ? "en"
            : "el",
      });
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "CUSTOMER",
        input: false,
      },
      disabled: {
        type: "boolean",
        required: true,
        defaultValue: false,
        input: false,
      },
      preferredLocale: {
        type: "string",
        required: true,
        defaultValue: "el",
        input: true,
      },
      surname: {
        type: "string",
        required: false,
        defaultValue: "",
        input: true,
      },
      accessStatus: {
        type: "string",
        required: true,
        defaultValue: "PENDING",
        input: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const preferredLocale = user.preferredLocale === "en" ? "en" : "el";
          const surname = typeof user.surname === "string" ? user.surname.trim() : "";

          return {
            data: {
              ...user,
              surname,
              role: "CUSTOMER",
              disabled: false,
              preferredLocale,
              accessStatus: "PENDING",
            },
          };
        },
        after: async (user) => {
          await recordApplicationLog({
            eventType: "account.created",
            actorType: "customer",
            actorId: user.id,
            targetType: "user",
            targetId: user.id,
            result: "success",
          });
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { disabled: true, role: true, accessExpiresAt: true },
          });

          if (
            user?.role === "CUSTOMER" &&
            user.accessExpiresAt &&
            user.accessExpiresAt.getTime() <= Date.now()
          ) {
            await lockExpiredCustomer(session.userId);
            return false;
          }

          if (!user || user.disabled) {
            return false;
          }
        },
      },
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const candidate = newPasswordFromRequest(ctx.path, ctx.body);

      if (typeof candidate !== "string" || passwordMeetsRules(candidate)) {
        return;
      }

      throw new APIError("BAD_REQUEST", {
        message: "Password does not meet the requirements",
        code: "PASSWORD_TOO_SHORT",
      });
    }),
  },
  plugins: [nextCookies()],
});
