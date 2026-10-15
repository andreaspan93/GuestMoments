import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventFormSchema } from "@/lib/events/schema";
import {
  defaultEventAppearance,
  eventFontFamily,
  logoCornerClass,
  logoImageClass,
  logoSizeClass,
} from "@/lib/events/appearance";
import { pathAfterEventCreated } from "@/lib/events/create-flow";
import { brandingSlots } from "@/lib/uploads/branding-client";

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
  it("keeps Noto Sans, a medium logo, and square corners as defaults", () => {
    expect(defaultEventAppearance).toEqual({
      titleFont: "noto-sans",
      guestFont: "noto-sans",
      logoSize: "medium",
      logoCorner: "square",
    });
    expect(eventFontFamily("noto-sans")).toContain("--font-noto-sans");
    expect(logoCornerClass("square")).toBe("rounded-none");
    expect(logoCornerClass("unknown")).toBe("rounded-none");
  });

  it("grows the logo from the previous large size through extra large", () => {
    const small = logoSizeClass("small", "screen");
    const medium = logoSizeClass("medium", "screen");
    const large = logoSizeClass("large", "screen");
    const extraLarge = logoSizeClass("extra-large", "screen");

    expect(small).toContain("h-24");
    expect(small).toContain("sm:h-32");
    expect(medium).toContain("h-36");
    expect(medium).toContain("sm:h-48");
    expect(large).toContain("h-48");
    expect(large).toContain("sm:h-64");
    expect(extraLarge).toContain("h-60");
    expect(extraLarge).toContain("sm:h-80");
    expect(small).toContain("object-contain");
    expect(extraLarge).not.toContain("object-cover");
    expect(logoSizeClass("medium", "print")).toContain("h-52");
    expect(logoSizeClass("extra-large", "print")).toContain("h-80");
  });

  it("falls back when a stored value is not one of the choices", () => {
    expect(eventFontFamily("comic-sans")).toContain("--font-noto-sans");
    expect(logoSizeClass("huge", "screen")).toContain("h-36");
  });

  it("keeps square logos unclipped and clips rounded logos to a circle", () => {
    const square = logoImageClass("large", "square", "screen");
    const rounded = logoImageClass("large", "rounded", "screen");

    expect(logoCornerClass("square")).toBe("rounded-none");
    expect(square).toContain("rounded-none");
    expect(square).toContain("object-contain");
    expect(square).toContain("self-center");
    expect(square).not.toContain("rounded-full");
    expect(square).not.toContain("object-cover");

    expect(logoCornerClass("rounded")).toContain("rounded-full");
    expect(logoCornerClass("rounded")).toContain("object-cover");
    expect(logoCornerClass("rounded")).toContain("overflow-hidden");
    expect(rounded).toContain("rounded-full");
    expect(rounded).toContain("aspect-square");
    expect(rounded).toContain("object-cover");
    expect(rounded).toContain("w-48");
    expect(rounded).toContain("sm:w-64");
    expect(rounded).not.toContain("object-contain");
    expect(rounded).not.toContain("rounded-3xl");

    for (const size of ["small", "medium", "large", "extra-large"] as const) {
      const circle = logoImageClass(size, "rounded", "screen");
      const printCircle = logoImageClass(size, "rounded", "print");
      expect(circle).toContain("aspect-square");
      expect(circle).toContain("rounded-full");
      expect(circle).toContain("object-cover");
      expect(printCircle).toContain("aspect-square");
      expect(printCircle).toContain("rounded-full");
      expect(logoImageClass(size, "square", "print")).toContain("object-contain");
      expect(logoImageClass(size, "square", "print")).toContain("rounded-none");
    }
  });

  it("accepts the shared create and edit choices and rejects unknown ones", () => {
    expect(eventFormSchema.safeParse(validForm).success).toBe(true);
    expect(
      eventFormSchema.safeParse({
        ...validForm,
        logoSize: "extra-large",
        logoCorner: "rounded",
      }).success,
    ).toBe(true);
    expect(
      eventFormSchema.safeParse({ ...validForm, titleFont: "papyrus", logoSize: "medium" }).success,
    ).toBe(false);
    expect(eventFormSchema.safeParse({ ...validForm, logoSize: "huge" }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...validForm, logoCorner: "circle" }).success).toBe(false);
  });

  it("uses the saved logo size and shape on the guest page, QR page, and print layout", () => {
    const guest = readFileSync(new URL("../../app/e/[code]/page.tsx", import.meta.url), "utf8");
    const qr = readFileSync(
      new URL("../../app/[locale]/events/[id]/qr/page.tsx", import.meta.url),
      "utf8",
    );
    const screen = 'logoImageClass(event.logoSize, event.logoCorner, "screen")';
    const print = 'logoImageClass(event.logoSize, event.logoCorner, "print")';

    expect(guest).toContain(screen);
    expect(qr).toContain(screen);
    expect(qr).toContain(print);
  });

  it("sends a new event to the event list and offers the same image slots as edit", () => {
    expect(pathAfterEventCreated()).toBe("/events");
    expect(brandingSlots).toEqual(["cover", "logo", "background"]);
  });
});
