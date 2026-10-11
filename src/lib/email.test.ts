import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

const consoleMethods = ["debug", "error", "info", "log", "warn"] as const;

function captureConsole() {
  const spies = consoleMethods.map((method) =>
    vi.spyOn(console, method).mockImplementation(() => {}),
  );

  return () => spies.flatMap((spy) => spy.mock.calls.flat().map(String)).join(" ");
}

describe("verification email", () => {
  afterEach(() => {
    send.mockClear();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sends through Resend and does not print the token in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "GuestMoments <mail@example.com>");
    const output = captureConsole();
    const url = "https://example.com/api/auth/verify-email?token=secret-token";

    await sendVerificationEmail({ to: "guest@example.com", url, locale: "el" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Επιβεβαίωση email GuestMoments",
        text: expect.stringContaining(url),
      }),
    );
    expect(output()).not.toContain("secret-token");
    expect(output()).not.toContain("guest@example.com");
  });

  it("still sends password reset mail through Resend", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const output = captureConsole();
    const url = "https://example.com/reset-password?token=reset-token";

    await sendPasswordResetEmail({ to: "guest@example.com", url, locale: "en" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Reset your GuestMoments password",
        text: expect.stringContaining(url),
      }),
    );
    expect(output()).not.toContain("reset-token");
    expect(output()).not.toContain("guest@example.com");
  });

  it("fails a production password reset without logging the link or address", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const output = captureConsole();
    const url = "https://example.com/reset-password?token=reset-token";
    const to = "guest@example.com";

    await expect(
      sendPasswordResetEmail({ to, url, locale: "en" }),
    ).rejects.toThrow("Email delivery is not configured");

    expect(send).not.toHaveBeenCalled();
    expect(output()).toBe("[password-reset] Email delivery is not configured");
    expect(output()).not.toContain("reset-token");
    expect(output()).not.toContain(url);
    expect(output()).not.toContain(to);
  });

  it("fails a production verification email without logging the link or address", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    const output = captureConsole();
    const url = "https://example.com/api/auth/verify-email?token=secret-token";
    const to = "guest@example.com";

    await expect(sendVerificationEmail({ to, url, locale: "el" })).rejects.toThrow(
      "Email delivery is not configured",
    );

    expect(send).not.toHaveBeenCalled();
    expect(output()).toBe("[email-verification] Email delivery is not configured");
    expect(output()).not.toContain("secret-token");
    expect(output()).not.toContain(url);
    expect(output()).not.toContain(to);
  });

  it("keeps the development fallback free of reset and verification secrets", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("RESEND_API_KEY", "");
    const output = captureConsole();
    const resetUrl = "https://example.com/reset-password?token=reset-token";
    const verifyUrl = "https://example.com/api/auth/verify-email?token=secret-token";
    const to = "guest@example.com";

    await sendPasswordResetEmail({ to, url: resetUrl, locale: "en" });
    await sendVerificationEmail({ to, url: verifyUrl, locale: "en" });

    expect(send).not.toHaveBeenCalled();
    expect(output()).toBe(
      [
        "[password-reset] Email delivery is not configured",
        "[email-verification] Email delivery is not configured",
      ].join(" "),
    );
    expect(output()).not.toContain("reset-token");
    expect(output()).not.toContain("secret-token");
    expect(output()).not.toContain(resetUrl);
    expect(output()).not.toContain(verifyUrl);
    expect(output()).not.toContain(to);
  });
});
