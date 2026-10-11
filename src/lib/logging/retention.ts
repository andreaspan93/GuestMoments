import "server-only";
import { prisma } from "@/lib/prisma";
import {
  eventTypesForCategory,
  type ApplicationLogCategory,
} from "@/lib/logging/catalog";

const DEFAULT_RETENTION_DAYS = {
  operational: 30,
  security: 180,
  authFailure: 90,
} as const;

const MAX_RETENTION_DAYS = 3650;

function retentionDays(category: ApplicationLogCategory) {
  const envName =
    category === "operational"
      ? "APP_LOG_RETENTION_OPERATIONAL_DAYS"
      : category === "security"
        ? "APP_LOG_RETENTION_SECURITY_DAYS"
        : "APP_LOG_RETENTION_AUTH_FAILURE_DAYS";
  const parsed = Number(process.env[envName]);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_RETENTION_DAYS) {
    return DEFAULT_RETENTION_DAYS[category];
  }

  return parsed;
}

function cutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function deleteExpiredApplicationLogs(now = new Date()) {
  const deleted = {
    operational: 0,
    security: 0,
    authFailure: 0,
  };

  for (const category of ["operational", "security", "authFailure"] as const) {
    const eventTypes = eventTypesForCategory(category);

    if (eventTypes.length === 0) {
      continue;
    }

    const result = await prisma.applicationLog.deleteMany({
      where: {
        eventType: { in: [...eventTypes] },
        createdAt: { lt: cutoff(now, retentionDays(category)) },
      },
    });

    deleted[category] = result.count;
  }

  return deleted;
}
