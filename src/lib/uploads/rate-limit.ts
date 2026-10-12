import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { UploadError } from "@/lib/uploads/errors";

const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 30;
const UPLOAD_RATE_LIMIT_PREFIX = "guestmoments";
const MAX_GUEST_KEY_SCAN_PAGES = 1000;
const EVENT_CODE = /^[A-Za-z0-9_-]{8,128}$/;

export function isGuestRateLimitBucket(bucket: string, eventCode: string) {
  return eventCode.length > 0 && bucket.startsWith("guest:") && bucket.endsWith(`:${eventCode}`);
}

export function guestRateLimitHitFilter(eventCode: string) {
  return {
    AND: [{ bucket: { startsWith: "guest:" } }, { bucket: { endsWith: `:${eventCode}` } }],
  };
}

export function isDeletedGuestRateLimitKey(
  key: string,
  eventCode: string,
  prefix = UPLOAD_RATE_LIMIT_PREFIX,
) {
  if (!EVENT_CODE.test(eventCode)) {
    return false;
  }

  const guestPrefix = `${prefix}:guest:`;

  if (!key.startsWith(guestPrefix)) {
    return false;
  }

  const rest = key.slice(guestPrefix.length);
  const splitAt = rest.lastIndexOf(":");

  if (splitAt <= 0) {
    return false;
  }

  const window = rest.slice(splitAt + 1);
  const identifier = rest.slice(0, splitAt);

  return /^\d+$/.test(window) && identifier.endsWith(`:${eventCode}`);
}

type GuestRateLimitRedis = {
  scan: (
    cursor: string | number,
    opts: { match: string; count: number },
  ) => Promise<[string | number, string[]]>;
  del: (...keys: string[]) => Promise<number>;
};

export async function deleteGuestRateLimitKeys(
  eventCodes: readonly string[],
  redis: GuestRateLimitRedis,
) {
  for (const eventCode of eventCodes) {
    if (!EVENT_CODE.test(eventCode)) {
      continue;
    }

    let cursor: string | number = 0;

    for (let page = 0; page < MAX_GUEST_KEY_SCAN_PAGES; page += 1) {
      const [next, keys] = await redis.scan(cursor, {
        match: `${UPLOAD_RATE_LIMIT_PREFIX}:guest:*:${eventCode}:*`,
        count: 100,
      });
      const matches = keys.filter((key) => isDeletedGuestRateLimitKey(key, eventCode));

      if (matches.length > 0) {
        await redis.del(...matches);
      }

      cursor = next;

      if (String(cursor) === "0") {
        break;
      }

      if (page === MAX_GUEST_KEY_SCAN_PAGES - 1) {
        throw new Error("Guest rate-limit cleanup did not finish");
      }
    }
  }
}

export async function deleteConfiguredGuestRateLimits(eventCodes: readonly string[]) {
  if (process.env.NODE_ENV === "test" || !upstashConfigured() || eventCodes.length === 0) {
    return;
  }

  await deleteGuestRateLimitKeys(eventCodes, Redis.fromEnv());
}

function upstashConfigured() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

export async function consumePostgresRateLimit(
  bucket: string,
  now: Date,
  limit = DEFAULT_LIMIT,
) {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);

  await prisma.rateLimitHit.deleteMany({
    where: {
      windowStart: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) },
    },
  });

  const existing = await prisma.rateLimitHit.findUnique({
    where: {
      bucket_windowStart: { bucket, windowStart },
    },
  });

  if (!existing) {
    try {
      await prisma.rateLimitHit.create({
        data: {
          id: randomUUID(),
          bucket,
          windowStart,
          count: 1,
        },
      });
      return;
    } catch (error) {
      if (
        !(
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        )
      ) {
        throw error;
      }
    }
  }

  const updated = await prisma.rateLimitHit.update({
    where: {
      bucket_windowStart: { bucket, windowStart },
    },
    data: {
      count: { increment: 1 },
    },
  });

  if (updated.count > limit) {
    throw new UploadError("rate");
  }
}

async function consumeUpstashRateLimit(bucket: string) {
  const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(DEFAULT_LIMIT, "10 m"),
    prefix: UPLOAD_RATE_LIMIT_PREFIX,
  });
  const result = await ratelimit.limit(bucket);

  if (!result.success) {
    throw new UploadError("rate");
  }
}

export async function consumeUploadRateLimit(bucket: string, now = new Date()) {
  if (upstashConfigured()) {
    await consumeUpstashRateLimit(bucket);
    return;
  }

  await consumePostgresRateLimit(bucket, now);
}
