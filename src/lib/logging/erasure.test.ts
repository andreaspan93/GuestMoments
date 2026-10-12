import { describe, expect, it, vi } from "vitest";
import { redactDeletedCustomerLog } from "@/lib/logging/erasure";
import {
  deleteGuestRateLimitKeys,
  isDeletedGuestRateLimitKey,
  isGuestRateLimitBucket,
} from "@/lib/uploads/rate-limit";

const customerId = "customer-1111";
const eventId = "event-2222";
const mediaId = "media-3333";
const albumId = "album-4444";
const otherId = "other-5555";
const scope = {
  userId: customerId,
  eventIds: [eventId],
  mediaIds: [mediaId],
  albumIds: [albumId],
};

describe("deleted customer log redaction", () => {
  it("deletes operational rows that identify the deleted customer or their content", () => {
    expect(
      redactDeletedCustomerLog(
        {
          eventType: "account.updated",
          actorId: customerId,
          targetType: "user",
          targetId: customerId,
          requestId: "req-12345678",
          metadata: { fields: ["name"] },
        },
        scope,
      ),
    ).toEqual({ action: "delete" });

    expect(
      redactDeletedCustomerLog(
        {
          eventType: "media.upload.succeeded",
          actorId: null,
          targetType: "media",
          targetId: mediaId,
          requestId: null,
          metadata: { eventId, mediaKind: "photo", uploadPurpose: "guest" },
        },
        scope,
      ),
    ).toEqual({ action: "delete" });
  });

  it("anonymizes security rows and keeps the reason, result context, and other people's ids", () => {
    expect(
      redactDeletedCustomerLog(
        {
          eventType: "auth.password.reset",
          actorId: customerId,
          targetType: "user",
          targetId: customerId,
          requestId: customerId,
          metadata: {},
        },
        scope,
      ),
    ).toEqual({
      action: "anonymize",
      actorId: null,
      targetType: null,
      targetId: null,
      requestId: null,
      metadata: {},
    });

    expect(
      redactDeletedCustomerLog(
        {
          eventType: "rate.limited",
          actorId: null,
          targetType: "event",
          targetId: eventId,
          requestId: "req-12345678",
          metadata: { reason: "upload", uploadPurpose: "guest", eventId },
        },
        scope,
      ),
    ).toEqual({
      action: "anonymize",
      actorId: null,
      targetType: null,
      targetId: null,
      requestId: "req-12345678",
      metadata: { reason: "upload", uploadPurpose: "guest" },
    });

    expect(
      redactDeletedCustomerLog(
        {
          eventType: "access.denied",
          actorId: otherId,
          targetType: "event",
          targetId: eventId,
          requestId: null,
          metadata: { reason: "forbidden", eventId },
        },
        scope,
      ),
    ).toEqual({
      action: "anonymize",
      actorId: otherId,
      targetType: null,
      targetId: null,
      requestId: null,
      metadata: { reason: "forbidden" },
    });
  });

  it("leaves unrelated logs unchanged", () => {
    const settings = {
      eventType: "settings.updated",
      actorId: "owner-9999",
      targetType: "settings",
      targetId: "default",
      requestId: null,
      metadata: { maxEventsPerCustomer: 10 },
    };
    const failedLogin = {
      eventType: "auth.login.failed",
      actorId: null,
      targetType: null,
      targetId: null,
      requestId: "req-87654321",
      metadata: { reason: "invalid_credentials" },
    };

    expect(redactDeletedCustomerLog(settings, scope)).toEqual({ action: "keep" });
    expect(redactDeletedCustomerLog(failedLogin, scope)).toEqual({ action: "keep" });
    expect(
      redactDeletedCustomerLog(
        {
          eventType: "auth.login.succeeded",
          actorId: otherId,
          targetType: "user",
          targetId: otherId,
          requestId: null,
          metadata: {},
        },
        scope,
      ),
    ).toEqual({ action: "keep" });
  });
});

describe("guest rate-limit cleanup", () => {
  const eventCode = "abcDEF123_-code";

  it("matches only guest buckets and keys for that event code", () => {
    expect(isGuestRateLimitBucket(`guest:203.0.113.8:${eventCode}`, eventCode)).toBe(true);
    expect(isGuestRateLimitBucket(`guest:2001:db8::1:${eventCode}`, eventCode)).toBe(true);
    expect(isGuestRateLimitBucket(`guest:203.0.113.8:${eventCode}extra`, eventCode)).toBe(false);
    expect(isGuestRateLimitBucket(`branding:customer:event`, eventCode)).toBe(false);
    expect(isGuestRateLimitBucket(`guest:203.0.113.8:other-code-value`, eventCode)).toBe(false);

    const key = `guestmoments:guest:203.0.113.8:${eventCode}:170000`;
    expect(isDeletedGuestRateLimitKey(key, eventCode)).toBe(true);
    expect(isDeletedGuestRateLimitKey(`guestmoments:guest:2001:db8::1:${eventCode}:42`, eventCode)).toBe(
      true,
    );
    expect(isDeletedGuestRateLimitKey(`guestmoments:branding:user:event:42`, eventCode)).toBe(false);
    expect(
      isDeletedGuestRateLimitKey(`guestmoments:guest:203.0.113.8:other-code-value:42`, eventCode),
    ).toBe(false);
    expect(isDeletedGuestRateLimitKey(`guestmoments:guest:*:${eventCode}:42`, "bad*code")).toBe(false);
  });

  it("deletes only matching Upstash keys and does not delete when the scan fails", async () => {
    const matching = `guestmoments:guest:203.0.113.8:${eventCode}:170000`;
    const deleted: string[] = [];
    let cursor = 0;

    await deleteGuestRateLimitKeys([eventCode], {
      async scan() {
        if (cursor === 0) {
          cursor = 1;
          return [
            "1",
            [
              matching,
              `guestmoments:branding:user:event:170000`,
              `guestmoments:guest:203.0.113.9:other-code-value:170000`,
              `guestmoments:guest:203.0.113.8:${eventCode}extra:170000`,
            ],
          ];
        }

        return ["0", []];
      },
      async del(...keys) {
        deleted.push(...keys);
        return keys.length;
      },
    });

    expect(deleted).toEqual([matching]);

    const del = vi.fn(async () => 0);
    await expect(
      deleteGuestRateLimitKeys([eventCode], {
        async scan() {
          throw new Error("redis unavailable");
        },
        del,
      }),
    ).rejects.toThrow("redis unavailable");
    expect(del).not.toHaveBeenCalled();
  });
});
