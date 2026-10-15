import { describe, expect, it } from "vitest";
import { eventFormSchema } from "@/lib/events/schema";
import {
  defaultEventAppearance,
  eventFontFamily,
  logoSizeClass,
} from "@/lib/events/appearance";

const validForm = {
  name: "Wedding",
  eventDate: "2027-06-15",
  welcomeMessageEl: "Καλώς ήρθατε",
  welcomeMessageEn: "Welcome",
  uploadInstructionsEl: "Ανεβάστε φωτογραφίες",
  uploadInstructionsEn: "",
  backgroundColor: "#f7f1ea",
  accentColor: "#8c3d32",
  privacyMode: "FULL_GALLERY",
  status: "ACTIVE",
  ...defaultEventAppearance,
};

describe("event appearance", () => {
  it("keeps the current Noto Sans and medium logo as defaults", () => {
    expect(defaultEventAppearance).toEqual({
      titleFont: "noto-sans",
      guestFont: "noto-sans",
      logoSize: "medium",
    });
    expect(eventFontFamily("noto-sans")).toContain("--font-noto-sans");
    expect(logoSizeClass("medium", "screen")).toContain("h-16");
    expect(logoSizeClass("medium", "print")).toContain("h-28");
  });

  it("falls back when a stored value is not one of the choices", () => {
    expect(eventFontFamily("comic-sans")).toContain("--font-noto-sans");
    expect(logoSizeClass("huge", "screen")).toContain("h-16");
  });

  it("uses a larger screen logo only for the large choice", () => {
    expect(logoSizeClass("small", "screen")).toContain("h-12");
    expect(logoSizeClass("large", "screen")).toContain("sm:h-32");
    expect(logoSizeClass("large", "screen")).not.toContain("object-cover");
  });

  it("accepts the shared create and edit defaults and rejects an unknown font", () => {
    expect(eventFormSchema.safeParse(validForm).success).toBe(true);
    expect(
      eventFormSchema.safeParse({ ...validForm, titleFont: "papyrus", logoSize: "medium" }).success,
    ).toBe(false);
    expect(eventFormSchema.safeParse({ ...validForm, logoSize: "huge" }).success).toBe(false);
  });
});
