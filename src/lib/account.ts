import { verifyPassword } from "better-auth/crypto";
import {
  IdentityError,
  accountUpdateSchema,
} from "@/lib/identity-schema";
import { prisma } from "@/lib/prisma";

type AccountUpdate = {
  userId: string;
  name: string;
  email: string;
  currentPassword: string;
};

async function passwordMatches(userId: string, password: string) {
  const account = await prisma.account.findFirst({
    where: {
      userId,
      providerId: "credential",
    },
    select: { password: true },
  });

  if (!account?.password) {
    return false;
  }

  return verifyPassword({
    hash: account.password,
    password,
  });
}

export async function applyAccountUpdate({
  userId,
  name,
  email,
  currentPassword,
}: AccountUpdate) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      disabled: true,
    },
  });

  if (!user || user.disabled) {
    throw new IdentityError("sessionExpired");
  }

  const emailChanged = email !== user.email;

  if (emailChanged) {
    if (!currentPassword) {
      throw new IdentityError("passwordRequired");
    }

    const matches = await passwordMatches(userId, currentPassword);

    if (!matches) {
      throw new IdentityError("invalidPassword");
    }
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        ...(emailChanged ? { email } : {}),
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new IdentityError("emailTaken");
    }

    throw error;
  }
}

export async function applyAccountUpdateFromInput(
  userId: string,
  input: unknown,
) {
  const parsed = accountUpdateSchema.safeParse(input);

  if (!parsed.success) {
    throw new IdentityError("invalid");
  }

  await applyAccountUpdate({
    userId,
    name: parsed.data.name,
    email: parsed.data.email,
    currentPassword: parsed.data.currentPassword,
  });
}
