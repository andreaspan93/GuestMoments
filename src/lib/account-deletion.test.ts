import { describe, expect, it } from "vitest";
import { ownAccountDeletionAllowed } from "./account-deletion-policy";

describe("own account deletion", () => {
  it("allows a customer to delete only the matching account", () => {
    expect(
      ownAccountDeletionAllowed({
        role: "CUSTOMER",
        email: "couple@example.com",
        confirmEmail: " Couple@Example.com ",
      }),
    ).toBe(true);
    expect(
      ownAccountDeletionAllowed({
        role: "CUSTOMER",
        email: "couple@example.com",
        confirmEmail: "other@example.com",
      }),
    ).toBe(false);
    expect(
      ownAccountDeletionAllowed({
        role: "OWNER",
        email: "owner@example.com",
        confirmEmail: "owner@example.com",
      }),
    ).toBe(false);
  });
});
