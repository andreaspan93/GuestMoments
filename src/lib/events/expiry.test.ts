import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  athensEndOfDay,
  expiresAtFor,
  isExpiryPast,
} from "./expiry";
import { eventFormSchema } from "./schema";
import { guestText } from "./text";
import { createEventCode, guestEventUrl } from "./code";
import { decideGuestAccess } from "./access";

const validForm = {
  name: "Wedding",
  eventDate: "2027-06-15",
  welcomeMessageEl: "Καλώς ήρθατε",
  welcomeMessageEn: "",
  uploadInstructionsEl: "Ανεβάστε φωτογραφίες",
  uploadInstructionsEn: "",
  backgroundColor: "#f7f1ea",
  accentColor: "#8c3d32",
  titleFont: "noto-sans",
  guestFont: "noto-sans",
  logoSize: "medium",
  logoCorner: "square",
  privacyMode: "FULL_GALLERY",
  guestDownloadsEnabled: true,
  retentionDays: 90,
  status: "ACTIVE",
};

describe("event expiry", () => {
  it("uses the end of the Athens calendar day in summer time", () => {
    expect(athensEndOfDay("2026-06-01").toISOString()).toBe(
      "2026-06-01T20:59:59.999Z",
    );
    expect(expiresAtFor("2026-06-01", 10).toISOString()).toBe(
      "2026-06-11T20:59:59.999Z",
    );
  });

  it("uses the end of the Athens calendar day in winter time", () => {
    expect(expiresAtFor("2026-01-15", 3).toISOString()).toBe(
      "2026-01-18T21:59:59.999Z",
    );
  });

  it("keeps the end of the day across Athens daylight-saving changes", () => {
    expect(athensEndOfDay("2026-03-29").toISOString()).toBe(
      "2026-03-29T20:59:59.999Z",
    );
    expect(athensEndOfDay("2026-10-25").toISOString()).toBe(
      "2026-10-25T21:59:59.999Z",
    );
  });

  it("adds calendar days across month ends", () => {
    expect(addCalendarDays("2026-01-31", 1)).toBe("2026-02-01");
  });

  it("calculates 30, 60, and 90 days from the event date", () => {
    expect(expiresAtFor("2026-06-01", 30).toISOString()).toBe("2026-07-01T20:59:59.999Z");
    expect(expiresAtFor("2026-06-01", 60).toISOString()).toBe("2026-07-31T20:59:59.999Z");
    expect(expiresAtFor("2026-06-01", 90).toISOString()).toBe("2026-08-30T20:59:59.999Z");
  });

  it("keeps an event available until the end of its retention day", () => {
    const expiresAt = expiresAtFor("2026-06-01", 60);
    const stillOpen = new Date(expiresAt.getTime() - 1);

    expect(isExpiryPast(expiresAt, stillOpen)).toBe(false);
    expect(isExpiryPast(expiresAt, expiresAt)).toBe(true);
  });

  it("treats an expiry equal to now as already past", () => {
    const expiresAt = expiresAtFor("2026-06-01", 0);

    expect(isExpiryPast(expiresAt, expiresAt)).toBe(true);
    expect(isExpiryPast(expiresAt, new Date(expiresAt.getTime() - 1))).toBe(
      false,
    );
  });
});

describe("guest text", () => {
  it("falls back to Greek when the English field is empty", () => {
    expect(guestText("en", "Γεια", "  ")).toBe("Γεια");
    expect(guestText("en", "Γεια", "Hello")).toBe("Hello");
    expect(guestText("el", "Γεια", "Hello")).toBe("Γεια");
  });
});

describe("event form", () => {
  it("accepts only 30, 60, and 90 days of retention", () => {
    for (const retentionDays of [30, 60, 90, "30", "60", "90"]) {
      const parsed = eventFormSchema.safeParse({ ...validForm, retentionDays });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.retentionDays).toBe(Number(retentionDays));
      }
    }

    expect(eventFormSchema.safeParse({ ...validForm, retentionDays: 10 }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...validForm, retentionDays: 120 }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...validForm, retentionDays: 0 }).success).toBe(false);
  });

  it("rejects storage fields", () => {
    const parsed = eventFormSchema.safeParse({
      ...validForm,
      maxStorageBytes: "5",
    });

    expect(parsed.success).toBe(false);
  });
});

describe("event code", () => {
  it("is at least 21 url-safe characters", () => {
    const code = createEventCode();

    expect(code.length).toBeGreaterThanOrEqual(21);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("builds a guest url without a language prefix", () => {
    expect(guestEventUrl("abcDEF1234567890_-xyz")).toBe(
      "http://localhost:3000/e/abcDEF1234567890_-xyz",
    );
  });
});

describe("guest access decision", () => {
  const future = new Date("2027-01-01T00:00:00.000Z");
  const now = new Date("2026-06-01T12:00:00.000Z");

  it("returns not found when there is no event", () => {
    expect(decideGuestAccess(null, now)).toEqual({ state: "not_found" });
  });

  it("refuses guest access after each retention period has ended", () => {
    for (const days of [30, 60, 90]) {
      const expiresAt = expiresAtFor("2026-06-01", days);

      expect(
        decideGuestAccess(
          { status: "ACTIVE", expiresAt, customerDisabled: false },
          new Date(expiresAt.getTime() - 1),
        ),
      ).toEqual({ state: "ok" });
      expect(
        decideGuestAccess(
          { status: "ACTIVE", expiresAt, customerDisabled: false },
          expiresAt,
        ),
      ).toEqual({ state: "unavailable" });
    }
  });

  it("refuses an expired event and a disabled customer", () => {
    expect(
      decideGuestAccess(
        {
          status: "ACTIVE",
          expiresAt: now,
          customerDisabled: false,
        },
        now,
      ),
    ).toEqual({ state: "unavailable" });
    expect(
      decideGuestAccess(
        {
          status: "ACTIVE",
          expiresAt: future,
          customerDisabled: true,
        },
        now,
      ),
    ).toEqual({ state: "unavailable" });
    expect(
      decideGuestAccess(
        {
          status: "DISABLED",
          expiresAt: future,
          customerDisabled: false,
        },
        now,
      ),
    ).toEqual({ state: "unavailable" });
  });

  it("allows an active unexpired event", () => {
    expect(
      decideGuestAccess(
        {
          status: "ACTIVE",
          expiresAt: future,
          customerDisabled: false,
        },
        now,
      ),
    ).toEqual({ state: "ok" });
  });
});
