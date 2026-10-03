import { prisma } from "@/lib/prisma";

export const accessStatuses = ["PENDING", "ACTIVE", "EXPIRED", "DISABLED"] as const;

export type AccessStatus = (typeof accessStatuses)[number];

export type AccessUser = {
  role: string;
  disabled: boolean;
  emailVerified: boolean;
  accessStatus: string;
  accessExpiresAt: Date | null;
};

const activationDays = [30, 60, 90, 180, 365] as const;

export type ActivationDays = (typeof activationDays)[number];

export function isActivationDays(value: number): value is ActivationDays {
  return activationDays.some((days) => days === value);
}

export function accessStatusOf(user: AccessUser, now: Date): AccessStatus {
  if (user.disabled || user.accessStatus === "DISABLED") {
    return "DISABLED";
  }

  if (
    user.accessExpiresAt &&
    user.accessExpiresAt.getTime() <= now.getTime() &&
    (user.accessStatus === "ACTIVE" || user.accessStatus === "EXPIRED")
  ) {
    return "EXPIRED";
  }

  if (user.accessStatus === "EXPIRED") {
    return "EXPIRED";
  }

  if (user.accessStatus === "ACTIVE") {
    return "ACTIVE";
  }

  return "PENDING";
}

export function canUseCustomerService(user: AccessUser, now: Date) {
  if (user.role === "OWNER") {
    return true;
  }

  return user.emailVerified && accessStatusOf(user, now) === "ACTIVE";
}

export function customerNotice(user: AccessUser, now: Date) {
  if (user.role === "OWNER") {
    return null;
  }

  const access = accessStatusOf(user, now);

  if (access === "DISABLED") {
    return "disabled" as const;
  }

  if (!user.emailVerified) {
    return "unverified" as const;
  }

  if (access === "EXPIRED") {
    return "expired" as const;
  }

  if (access !== "ACTIVE") {
    return "pending" as const;
  }

  return null;
}

export function accessExpiryFromDays(days: number, from: Date) {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function customerHasServiceAccess(
  actor: { id: string; role: string },
  now = new Date(),
) {
  if (actor.role === "OWNER") {
    return true;
  }

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: {
      role: true,
      disabled: true,
      emailVerified: true,
      accessStatus: true,
      accessExpiresAt: true,
    },
  });

  if (!user) {
    return false;
  }

  if (user.role === "OWNER") {
    return true;
  }

  if (
    !user.disabled &&
    user.accessStatus === "ACTIVE" &&
    user.accessExpiresAt &&
    user.accessExpiresAt.getTime() <= now.getTime()
  ) {
    await prisma.user.update({
      where: { id: actor.id },
      data: { accessStatus: "EXPIRED" },
    });
    user.accessStatus = "EXPIRED";
  }

  return canUseCustomerService(user, now);
}

export async function grantCustomerService(
  userId: string,
  accessExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerified: true,
      disabled: false,
      accessStatus: "ACTIVE",
      accessExpiresAt,
    },
  });
}
