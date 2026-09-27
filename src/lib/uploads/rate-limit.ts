import { randomUUID } from "node:crypto";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { prisma } from "@/lib/prisma";
import { UploadError } from "@/lib/uploads/errors";

const WINDOW_MS = 10 * 60 * 1000;
const DEFAULT_LIMIT = 30;

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
    prefix: "guestmoments",
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
