import { describe, expect, it } from "vitest";
import { securityHeaders } from "./security-headers";

describe("security headers", () => {
  it("sets the baseline browser protections", () => {
    expect(Object.fromEntries(securityHeaders.map((header) => [header.key, header.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    });
  });
});
