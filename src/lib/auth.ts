import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
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

          return {
            data: {
              ...user,
              role: "CUSTOMER",
              disabled: false,
              preferredLocale,
              accessStatus: "PENDING",
            },
          };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await prisma.user.findUnique({
            where: { id: session.userId },
            select: { disabled: true },
          });

          if (!user || user.disabled) {
            return false;
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});
