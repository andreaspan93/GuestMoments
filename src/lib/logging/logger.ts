import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  sanitizeApplicationLog,
  type ApplicationLogRow,
} from "@/lib/logging/catalog";

type LogWriter = (row: ApplicationLogRow) => Promise<void>;

async function writeApplicationLog(row: ApplicationLogRow) {
  await prisma.applicationLog.create({
    data: {
      id: row.id,
      eventType: row.eventType,
      actorType: row.actorType,
      actorId: row.actorId,
      targetType: row.targetType,
      targetId: row.targetId,
      result: row.result,
      requestId: row.requestId,
      metadata: row.metadata as Prisma.InputJsonValue,
    },
  });
}

export class LogWriteError extends Error {
  constructor() {
    super("log_write_failed");
    this.name = "LogWriteError";
  }
}

export async function recordApplicationLog(input: unknown, write?: LogWriter) {
  try {
    const row = sanitizeApplicationLog(input);

    if (!row) {
      return false;
    }

    await (write ?? writeApplicationLog)(row);
    return true;
  } catch {
    return false;
  }
}

export function requireApplicationLogRow(input: unknown) {
  const row = sanitizeApplicationLog(input);

  if (!row) {
    throw new LogWriteError();
  }

  return row;
}

export async function recordUnexpectedError() {
  await recordApplicationLog({
    eventType: "app.error",
    actorType: "system",
    result: "failure",
    metadata: { reason: "unexpected" },
  });
}
