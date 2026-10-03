import { describe, expect, it } from "vitest";
import {
  accessExpiryFromDays,
  accessStatusOf,
  canUseCustomerService,
  customerNotice,
  type AccessUser,
} from "@/lib/access";

const now = new Date("2026-10-03T12:00:00.000Z");

function user(overrides: Partial<AccessUser> = {}): AccessUser {
  return {
    role: "CUSTOMER",
    disabled: false,
    emailVerified: true,
    accessStatus: "PENDING",
    accessExpiresAt: null,
    ...overrides,
  };
}

describe("customer access", () => {
  it("treats a missing expiry on an active customer as active", () => {
    expect(accessStatusOf(user({ accessStatus: "ACTIVE" }), now)).toBe("ACTIVE");
    expect(canUseCustomerService(user({ accessStatus: "ACTIVE" }), now)).toBe(true);
  });

  it("treats a passed expiry as expired even while the stored status is active", () => {
    const expired = user({
      accessStatus: "ACTIVE",
      accessExpiresAt: new Date("2026-10-03T11:00:00.000Z"),
    });

    expect(accessStatusOf(expired, now)).toBe("EXPIRED");
    expect(canUseCustomerService(expired, now)).toBe(false);
    expect(customerNotice(expired, now)).toBe("expired");
  });

  it("keeps a disabled customer blocked when the expiry is still in the future", () => {
    const disabled = user({
      disabled: true,
      accessStatus: "DISABLED",
      accessExpiresAt: new Date("2027-01-01T00:00:00.000Z"),
    });

    expect(accessStatusOf(disabled, now)).toBe("DISABLED");
    expect(canUseCustomerService(disabled, now)).toBe(false);
  });

  it("asks an unverified customer to verify before showing pending access", () => {
    expect(customerNotice(user({ emailVerified: false }), now)).toBe("unverified");
    expect(canUseCustomerService(user({ emailVerified: false, accessStatus: "ACTIVE" }), now)).toBe(
      false,
    );
  });

  it("does not apply customer expiry to an owner", () => {
    const owner = user({
      role: "OWNER",
      emailVerified: false,
      accessStatus: "EXPIRED",
      accessExpiresAt: new Date("2020-01-01T00:00:00.000Z"),
    });

    expect(canUseCustomerService(owner, now)).toBe(true);
    expect(customerNotice(owner, now)).toBeNull();
  });

  it("adds a whole number of days", () => {
    expect(accessExpiryFromDays(30, now).toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });
});
