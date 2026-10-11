import { describe, expect, it } from "vitest";
import { recordApplicationLog } from "@/lib/logging/logger";
import { sanitizeApplicationLog, safeRequestId } from "@/lib/logging/catalog";

const validLog = {
  eventType: "media.upload.rejected",
  actorType: "guest",
  result: "denied",
  metadata: { reason: "type", uploadPurpose: "guest" },
};

describe("application log sanitizing", () => {
  it("keeps an allowlisted event and metadata", () => {
    const row = sanitizeApplicationLog({
      ...validLog,
      actorId: "customer-1",
      targetType: "event",
      targetId: "event-1",
      requestId: "req-12345678",
    });

    expect(row).toMatchObject({
      eventType: "media.upload.rejected",
      actorType: "guest",
      actorId: "customer-1",
      targetType: "event",
      targetId: "event-1",
      result: "denied",
      requestId: "req-12345678",
      metadata: { reason: "type", uploadPurpose: "guest" },
    });
  });

  it("rejects an unknown event type", () => {
    expect(
      sanitizeApplicationLog({
        ...validLog,
        eventType: "ui.click",
      }),
    ).toBeNull();
  });

  it("drops metadata that contains secrets, headers, or a request body", () => {
    const row = sanitizeApplicationLog({
      ...validLog,
      metadata: {
        reason: "type",
        password: "Password123!",
        authorization: "Bearer secret",
        cookie: "session=abc",
        headers: { "x-forwarded-for": "203.0.113.10" },
        body: { email: "guest@example.com", guestToken: "token-value" },
        email: "guest@example.com",
        url: "https://example.com/e/code?token=1",
      },
    });

    expect(row?.metadata).toEqual({});
    expect(JSON.stringify(row)).not.toContain("Password123!");
    expect(JSON.stringify(row)).not.toContain("guest@example.com");
    expect(JSON.stringify(row)).not.toContain("Bearer");
    expect(JSON.stringify(row)).not.toContain("203.0.113.10");
  });

  it("drops an email address or secret used as an actor or request id", () => {
    const row = sanitizeApplicationLog({
      ...validLog,
      actorId: "guest@example.com",
      requestId: "Bearer secret-token",
    });

    expect(row?.actorId).toBeNull();
    expect(row?.requestId).toBeNull();
    expect(safeRequestId("https://example.com/reset?token=abc")).toBeNull();
  });
});

describe("application log failures", () => {
  it("does not throw when the log write fails", async () => {
    await expect(
      recordApplicationLog(validLog, async () => {
        throw new Error("database unavailable");
      }),
    ).resolves.toBe(false);
  });

  it("does not write a rejected event", async () => {
    let writes = 0;

    await expect(
      recordApplicationLog(
        { ...validLog, eventType: "not.allowed" },
        async () => {
          writes += 1;
        },
      ),
    ).resolves.toBe(false);
    expect(writes).toBe(0);
  });
});
