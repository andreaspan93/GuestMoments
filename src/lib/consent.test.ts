import { describe, expect, it } from "vitest";
import {
  CONSENT_VERSION,
  parseConsent,
  preferenceCookiesToClear,
  serializeConsent,
} from "./consent";

describe("consent choice", () => {
  it("stores the version and does not treat a newer version as the same choice", () => {
    const saved = serializeConsent(false, new Date("2026-10-17T12:00:00.000Z"));

    expect(parseConsent(saved)).toEqual({
      version: CONSENT_VERSION,
      preferences: false,
      decidedAt: "2026-10-17T12:00:00.000Z",
    });
    expect(parseConsent(saved.replace(`"version":${CONSENT_VERSION}`, '"version":2'))).toBeNull();
  });

  it("rejects malformed choices", () => {
    expect(parseConsent(undefined)).toBeNull();
    expect(parseConsent("{")).toBeNull();
    expect(parseConsent('{"version":1,"preferences":"yes","decidedAt":"2026-10-17T12:00:00.000Z"}')).toBeNull();
  });

  it("does not clear language cookies, because the locale switch needs them", () => {
    expect(preferenceCookiesToClear(undefined)).toEqual([]);
    expect(
      preferenceCookiesToClear(serializeConsent(false, new Date("2026-10-17T12:00:00.000Z"))),
    ).toEqual([]);
  });
});
