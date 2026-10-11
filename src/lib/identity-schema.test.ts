import { describe, expect, it } from "vitest";
import {
  accountUpdateSchema,
  changePasswordSchema,
  preferredLocaleFromPage,
  registerSchema,
} from "./identity-schema";

const validPassword = "Password123!";

describe("identity schemas", () => {
  it("accepts a signup with separate name and surname", () => {
    const parsed = registerSchema.safeParse({
      name: " Alex ",
      surname: " Papadopoulos ",
      email: "Alex@Example.com",
      password: validPassword,
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe("Alex");
      expect(parsed.data.surname).toBe("Papadopoulos");
      expect(parsed.data.email).toBe("alex@example.com");
    }
  });

  it("rejects role and disabled on registration input", () => {
    const parsed = registerSchema.safeParse({
      name: "Alex",
      surname: "Papadopoulos",
      email: "alex@example.com",
      password: validPassword,
      role: "OWNER",
      disabled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects a password shorter than 10 characters", () => {
    expect(
      registerSchema.safeParse({
        name: "Alex",
        surname: "Papadopoulos",
        email: "alex@example.com",
        password: "Pass1!",
      }).success,
    ).toBe(false);
  });

  it("rejects a password without a letter, number, or symbol", () => {
    const base = {
      name: "Alex",
      surname: "Papadopoulos",
      email: "alex@example.com",
    };

    expect(
      registerSchema.safeParse({ ...base, password: "1234567890!" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: "Password!!!!" }).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({ ...base, password: "Password1234" }).success,
    ).toBe(false);
  });

  it("accepts a signup password that meets every rule", () => {
    expect(
      registerSchema.safeParse({
        name: "Alex",
        surname: "Papadopoulos",
        email: "alex@example.com",
        password: validPassword,
      }).success,
    ).toBe(true);
  });

  it("rejects role and disabled on account update input", () => {
    const parsed = accountUpdateSchema.safeParse({
      name: "Alex",
      surname: "Papadopoulos",
      role: "OWNER",
      disabled: true,
    });

    expect(parsed.success).toBe(false);
  });

  it("allows an existing account to keep an empty surname", () => {
    const parsed = accountUpdateSchema.safeParse({
      name: "Alex",
      surname: "",
    });

    expect(parsed.success).toBe(true);
  });

  it("saves name and surname independently", () => {
    expect(
      accountUpdateSchema.safeParse({ name: "Mary", surname: "Smith" }).success,
    ).toBe(true);
    expect(
      accountUpdateSchema.safeParse({ name: "Mary", surname: "Jones" }).success,
    ).toBe(true);
    expect(
      accountUpdateSchema.safeParse({ name: "Helen", surname: "Jones" }).success,
    ).toBe(true);
  });

  it("rejects a password change when the new passwords do not match", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "password123",
      newPassword: validPassword,
      confirmPassword: "Password123?",
    });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path[0] === "confirmPassword")).toBe(
        true,
      );
    }
  });

  it("does not apply new-password rules to the current password", () => {
    const parsed = changePasswordSchema.safeParse({
      currentPassword: "password123",
      newPassword: validPassword,
      confirmPassword: validPassword,
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects a new password that misses a letter, number, or symbol", () => {
    for (const newPassword of ["1234567890!", "Password!!!!", "Password1234", "Pass1!"]) {
      expect(
        changePasswordSchema.safeParse({
          currentPassword: "password123",
          newPassword,
          confirmPassword: newPassword,
        }).success,
      ).toBe(false);
    }
  });

  it("stores English only when the page locale is English", () => {
    expect(preferredLocaleFromPage("en")).toBe("en");
    expect(preferredLocaleFromPage("el")).toBe("el");
    expect(preferredLocaleFromPage("fr")).toBe("el");
  });
});
