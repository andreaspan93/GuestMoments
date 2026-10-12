import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import {
  APPLICATION_LOG_EVENTS,
  applicationLogCategory,
  type ApplicationLogEvent,
} from "@/lib/logging/catalog";
import { prisma } from "@/lib/prisma";

export type DeletedCustomerScope = {
  userId: string;
  eventIds: readonly string[];
  mediaIds: readonly string[];
  albumIds: readonly string[];
};

export type LogIdentity = {
  eventType: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  requestId: string | null;
  metadata: Prisma.JsonValue;
};

export type LogRedaction =
  | { action: "keep" }
  | { action: "delete" }
  | {
      action: "anonymize";
      actorId: string | null;
      targetType: string | null;
      targetId: string | null;
      requestId: string | null;
      metadata: Record<string, unknown>;
    };

const knownEvents = new Set<string>(APPLICATION_LOG_EVENTS);

function isKnownEvent(eventType: string): eventType is ApplicationLogEvent {
  return knownEvents.has(eventType);
}

function scopeIds(scope: DeletedCustomerScope) {
  return new Set([scope.userId, ...scope.eventIds, ...scope.mediaIds, ...scope.albumIds]);
}

function metadataRecord(metadata: Prisma.JsonValue) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return {};
  }

  return { ...metadata };
}

function metadataEventId(metadata: Prisma.JsonValue) {
  const record = metadataRecord(metadata);
  return typeof record.eventId === "string" ? record.eventId : null;
}

export function logIdentifiesDeletedCustomer(row: LogIdentity, scope: DeletedCustomerScope) {
  const ids = scopeIds(scope);

  if (row.actorId && ids.has(row.actorId)) {
    return true;
  }

  if (row.targetId && ids.has(row.targetId)) {
    return true;
  }

  if (row.requestId && ids.has(row.requestId)) {
    return true;
  }

  const eventId = metadataEventId(row.metadata);
  return Boolean(eventId && ids.has(eventId));
}

export function redactDeletedCustomerLog(row: LogIdentity, scope: DeletedCustomerScope): LogRedaction {
  if (!logIdentifiesDeletedCustomer(row, scope)) {
    return { action: "keep" };
  }

  if (isKnownEvent(row.eventType) && applicationLogCategory(row.eventType) === "operational") {
    return { action: "delete" };
  }

  const ids = scopeIds(scope);
  const metadata = metadataRecord(row.metadata);

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string" && ids.has(value)) {
      delete metadata[key];
    }
  }

  const targetId = row.targetId && ids.has(row.targetId) ? null : row.targetId;

  return {
    action: "anonymize",
    actorId: row.actorId && ids.has(row.actorId) ? null : row.actorId,
    targetType: targetId ? row.targetType : null,
    targetId,
    requestId: row.requestId && ids.has(row.requestId) ? null : row.requestId,
    metadata,
  };
}

function associationWhere(scope: DeletedCustomerScope): Prisma.ApplicationLogWhereInput {
  const contentIds = [...scope.eventIds, ...scope.mediaIds, ...scope.albumIds];
  const or: Prisma.ApplicationLogWhereInput[] = [
    { actorId: scope.userId },
    { targetId: scope.userId },
    { requestId: scope.userId },
  ];

  if (contentIds.length > 0) {
    or.push({ targetId: { in: contentIds } }, { requestId: { in: contentIds } });
  }

  for (const eventId of scope.eventIds) {
    or.push({ metadata: { path: ["eventId"], equals: eventId } });
  }

  return { OR: or };
}

export async function eraseDeletedCustomerLogs(scope: DeletedCustomerScope) {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.applicationLog.findMany({
      where: associationWhere(scope),
      select: {
        id: true,
        eventType: true,
        actorId: true,
        targetType: true,
        targetId: true,
        requestId: true,
        metadata: true,
      },
    });
    const deleteIds: string[] = [];

    for (const row of rows) {
      const redaction = redactDeletedCustomerLog(row, scope);

      if (redaction.action === "delete") {
        deleteIds.push(row.id);
        continue;
      }

      if (redaction.action !== "anonymize") {
        continue;
      }

      await tx.applicationLog.update({
        where: { id: row.id },
        data: {
          actorId: redaction.actorId,
          targetType: redaction.targetType,
          targetId: redaction.targetId,
          requestId: redaction.requestId,
          metadata: redaction.metadata as Prisma.InputJsonValue,
        },
      });
    }

    if (deleteIds.length > 0) {
      await tx.applicationLog.deleteMany({
        where: { id: { in: deleteIds } },
      });
    }
  });
}
