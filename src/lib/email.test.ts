import { afterEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn().mockResolvedValue({}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendPasswordResetEmail, sendVerificationEmail } from "@/lib/email";

describe("verification email", () => {
  afterEach(() => {
    send.mockClear();
    vi.unstubAllEnvs();
  });

  it("sends through Resend and does not print the token in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubEnv("EMAIL_FROM", "GuestMoments <mail@example.com>");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const url = "https://example.com/api/auth/verify-email?token=secret-token";

    await sendVerificationEmail({ to: "guest@example.com", url, locale: "el" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Επιβεβαίωση email GuestMoments",
        text: expect.stringContaining(url),
      }),
    );
    expect(info.mock.calls.flat().join(" ")).not.toContain("secret-token");
    info.mockRestore();
  });

  it("still sends password reset mail through Resend", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    const url = "https://example.com/reset-password?token=reset-token";

    await sendPasswordResetEmail({ to: "guest@example.com", url, locale: "en" });

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "guest@example.com",
        subject: "Reset your GuestMoments password",
        text: expect.stringContaining(url),
      }),
    );
  });
});
