import { describe, expect, it } from "vitest";
import {
  accountUpdateSchema,
  preferredLocaleFromPage,
  registerSchema,
} from "./identity-schema";

describe("identity schemas", () => {
  it("rejects role and disabled on registration input", () => {
    const parsed = registerSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      password: "password123",
      role: "OWNER",
      disabled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects role and disabled on account update input", () => {
    const parsed = accountUpdateSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      currentPassword: "password123",
      newPassword: "",
      role: "OWNER",
      disabled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("stores English only when the page locale is English", () => {
    expect(preferredLocaleFromPage("en")).toBe("en");
    expect(preferredLocaleFromPage("el")).toBe("el");
    expect(preferredLocaleFromPage("fr")).toBe("el");
  });
});
