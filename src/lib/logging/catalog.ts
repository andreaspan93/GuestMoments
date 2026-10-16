import { randomUUID } from "node:crypto";

export const APPLICATION_LOG_EVENTS = [
  "account.created",
  "account.updated",
  "account.deleted",
  "account.access.changed",
  "auth.login.succeeded",
  "auth.login.failed",
  "auth.password.changed",
  "auth.password.reset",
  "event.created",
  "event.updated",
  "event.deleted",
  "media.upload.succeeded",
  "media.upload.rejected",
  "media.deleted",
  "media.visibility.changed",
  "media.bulk.assigned",
  "album.created",
  "album.renamed",
  "album.deleted",
  "access.denied",
  "rate.limited",
  "settings.updated",
  "app.error",
] as const;

export const APPLICATION_LOG_ACTORS = [
  "customer",
  "owner",
  "guest",
  "anonymous",
  "system",
] as const;

export const APPLICATION_LOG_RESULTS = ["success", "failure", "denied"] as const;

export const APPLICATION_LOG_TARGETS = [
  "user",
  "event",
  "media",
  "album",
  "settings",
  "upload",
] as const;

export const APPLICATION_LOG_REASONS = [
  "invalid_credentials",
  "invalid_password",
  "email_taken",
  "weak_password",
  "unauthenticated",
  "forbidden",
  "inactive",
  "unauthorized",
  "not_found",
  "rate",
  "type",
  "oversize",
  "quota",
  "intent",
  "upload",
  "cron",
  "unexpected",
] as const;

export const APPLICATION_LOG_FIELDS = [
  "name",
  "surname",
  "privacyMode",
  "guestDownloadsEnabled",
  "status",
  "retentionDays",
  "maxStorageBytes",
  "customerId",
  "disabled",
  "accessStatus",
  "defaultRetentionDays",
  "defaultMaxStorageBytes",
  "maxPhotoBytes",
  "maxVideoBytes",
  "maxEventsPerCustomer",
] as const;

const RETENTION_CATEGORY = {
  "account.created": "operational",
  "account.updated": "operational",
  "auth.login.succeeded": "operational",
  "event.created": "operational",
  "event.updated": "operational",
  "event.deleted": "operational",
  "media.upload.succeeded": "operational",
  "media.deleted": "operational",
  "media.visibility.changed": "operational",
  "media.bulk.assigned": "operational",
  "album.created": "operational",
  "album.renamed": "operational",
  "album.deleted": "operational",
  "app.error": "operational",
  "auth.login.failed": "authFailure",
  "auth.password.changed": "security",
  "auth.password.reset": "security",
  "account.deleted": "security",
  "account.access.changed": "security",
  "media.upload.rejected": "security",
  "access.denied": "security",
  "rate.limited": "security",
  "settings.updated": "security",
} as const;

export type ApplicationLogEvent = (typeof APPLICATION_LOG_EVENTS)[number];
export type ApplicationLogCategory = "operational" | "security" | "authFailure";

export type ApplicationLogRow = {
  id: string;
  eventType: ApplicationLogEvent;
  actorType: (typeof APPLICATION_LOG_ACTORS)[number];
  actorId: string | null;
  targetType: (typeof APPLICATION_LOG_TARGETS)[number] | null;
  targetId: string | null;
  result: (typeof APPLICATION_LOG_RESULTS)[number];
  requestId: string | null;
  metadata: Record<string, unknown>;
};

const FORBIDDEN_KEYS = new Set([
  "password",
  "newpassword",
  "currentpassword",
  "confirmpassword",
  "hash",
  "token",
  "guesttoken",
  "secret",
  "cookie",
  "cookies",
  "authorization",
  "headers",
  "header",
  "body",
  "request",
  "response",
  "email",
  "name",
  "surname",
  "ip",
  "ipaddress",
  "url",
  "filename",
  "originalfilename",
  "storagekey",
  "apikey",
  "session",
]);

const INTERNAL_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function applicationLogCategory(eventType: ApplicationLogEvent): ApplicationLogCategory {
  return RETENTION_CATEGORY[eventType];
}

export function eventTypesForCategory(category: ApplicationLogCategory) {
  return APPLICATION_LOG_EVENTS.filter(
    (eventType) => applicationLogCategory(eventType) === category,
  );
}

export function actorTypeForRole(role: string | null | undefined) {
  if (role === "OWNER") {
    return "owner" as const;
  }

  if (role === "CUSTOMER") {
    return "customer" as const;
  }

  return "anonymous" as const;
}

export function isInternalId(value: string) {
  return INTERNAL_ID.test(value) && !looksSensitive(value);
}

export function safeRequestId(value: string | null | undefined) {
  if (!value || !/^[A-Za-z0-9._:-]{8,80}$/.test(value) || looksSensitive(value)) {
    return null;
  }

  return value;
}

function looksSensitive(value: string) {
  const lower = value.toLowerCase();

  return (
    lower.includes("@") ||
    lower.includes("bearer") ||
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("password") ||
    lower.includes("://") ||
    lower.includes("eyj")
  );
}

function isMember<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && values.some((item) => item === value);
}

function plainObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

function sanitizedMetadata(value: unknown) {
  const source = plainObject(value);

  if (!source) {
    return {};
  }

  const keys = Object.keys(source);

  if (
    keys.some((key) => FORBIDDEN_KEYS.has(key.toLowerCase()) || !allowedMetadataKey(key))
  ) {
    return {};
  }

  const metadata: Record<string, unknown> = {};
  const reason = source.reason;
  const fields = source.fields;
  const count = source.count;
  const mediaKind = source.mediaKind;
  const visibility = source.visibility;
  const uploadPurpose = source.uploadPurpose;
  const privacyMode = source.privacyMode;
  const eventStatus = source.eventStatus;
  const eventId = source.eventId;
  const retentionDays = source.retentionDays;
  const quotaMib = source.quotaMib;
  const maxPhotoMib = source.maxPhotoMib;
  const maxVideoMib = source.maxVideoMib;
  const maxEventsPerCustomer = source.maxEventsPerCustomer;

  if (isMember(APPLICATION_LOG_REASONS, reason)) {
    metadata.reason = reason;
  }

  if (
    Array.isArray(fields) &&
    fields.length > 0 &&
    fields.length <= 8 &&
    fields.every((field) => isMember(APPLICATION_LOG_FIELDS, field))
  ) {
    metadata.fields = fields;
  }

  if (typeof count === "number" && Number.isInteger(count) && count >= 0 && count <= 10_000) {
    metadata.count = count;
  }

  if (mediaKind === "photo" || mediaKind === "video") {
    metadata.mediaKind = mediaKind;
  }

  if (visibility === "hidden" || visibility === "visible") {
    metadata.visibility = visibility;
  }

  if (uploadPurpose === "guest" || uploadPurpose === "branding") {
    metadata.uploadPurpose = uploadPurpose;
  }

  if (privacyMode === "OWN_UPLOADS" || privacyMode === "FULL_GALLERY") {
    metadata.privacyMode = privacyMode;
  }

  if (eventStatus === "ACTIVE" || eventStatus === "DISABLED") {
    metadata.eventStatus = eventStatus;
  }

  if (typeof eventId === "string" && isInternalId(eventId)) {
    metadata.eventId = eventId;
  }

  assignBoundedInt(metadata, "retentionDays", retentionDays, 0, 3650);
  assignBoundedInt(metadata, "quotaMib", quotaMib, 1, 10_485_760);
  assignBoundedInt(metadata, "maxPhotoMib", maxPhotoMib, 1, 2048);
  assignBoundedInt(metadata, "maxVideoMib", maxVideoMib, 1, 10_240);
  assignBoundedInt(metadata, "maxEventsPerCustomer", maxEventsPerCustomer, 1, 1000);

  return metadata;
}

function allowedMetadataKey(key: string) {
  return [
    "reason",
    "fields",
    "count",
    "mediaKind",
    "visibility",
    "uploadPurpose",
    "privacyMode",
    "eventStatus",
    "eventId",
    "retentionDays",
    "quotaMib",
    "maxPhotoMib",
    "maxVideoMib",
    "maxEventsPerCustomer",
  ].includes(key);
}

function assignBoundedInt(
  metadata: Record<string, unknown>,
  key: string,
  value: unknown,
  min: number,
  max: number,
) {
  if (typeof value === "number" && Number.isInteger(value) && value >= min && value <= max) {
    metadata[key] = value;
  }
}

export function sanitizeApplicationLog(input: unknown): ApplicationLogRow | null {
  const source = plainObject(input);

  if (!source || !isMember(APPLICATION_LOG_EVENTS, source.eventType)) {
    return null;
  }

  if (!isMember(APPLICATION_LOG_ACTORS, source.actorType)) {
    return null;
  }

  if (!isMember(APPLICATION_LOG_RESULTS, source.result)) {
    return null;
  }

  const actorId =
    typeof source.actorId === "string" && isInternalId(source.actorId) ? source.actorId : null;
  const targetType = isMember(APPLICATION_LOG_TARGETS, source.targetType)
    ? source.targetType
    : null;
  const targetId =
    typeof source.targetId === "string" && isInternalId(source.targetId)
      ? source.targetId
      : null;

  return {
    id: randomUUID(),
    eventType: source.eventType,
    actorType: source.actorType,
    actorId,
    targetType: targetType && targetId ? targetType : null,
    targetId: targetType && targetId ? targetId : null,
    result: source.result,
    requestId: safeRequestId(typeof source.requestId === "string" ? source.requestId : null),
    metadata: sanitizedMetadata(source.metadata),
  };
}
