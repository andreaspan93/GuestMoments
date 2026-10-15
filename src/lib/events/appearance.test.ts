import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventFormSchema } from "@/lib/events/schema";
import {
  defaultEventAppearance,
  eventFontFamily,
  logoCornerClass,
  logoImageClass,
  logoSizeClass,
  posterTitleSize,
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
    const smallPrint = logoSizeClass("small", "print");
    const mediumPrint = logoSizeClass("medium", "print");
    const extraLargePrint = logoSizeClass("extra-large", "print");

    expect(smallPrint).toContain("6.5cqh");
    expect(smallPrint).toContain("max-h-[14mm]");
    expect(mediumPrint).toContain("8cqh");
    expect(mediumPrint).toContain("max-h-[18mm]");
    expect(extraLargePrint).toContain("11cqh");
    expect(extraLargePrint).toContain("max-h-[24mm]");
    expect(extraLargePrint).not.toContain("h-80");
    expect(mediumPrint).not.toContain("h-52");
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
      expect(printCircle).toContain("object-cover");
      expect(printCircle).not.toContain("object-contain");
      expect(printCircle).not.toContain("rounded-3xl");
      const squarePrint = logoImageClass(size, "square", "print");
      expect(squarePrint).toContain("object-contain");
      expect(squarePrint).toContain("rounded-none");
      expect(squarePrint).not.toContain("rounded-full");
      expect(squarePrint).toMatch(/max-h-\[(14|18|21|24)mm\]/);
      expect(printCircle).toMatch(/max-w-\[(14|18|21|24)mm\]/);
    }
  });

  it("shrinks the poster title as the event name gets longer", () => {
    const shortName = posterTitleSize("Wedding");
    const mediumName = posterTitleSize("A".repeat(40));
    const longName = posterTitleSize("A".repeat(70));
    const longestName = posterTitleSize("Ω".repeat(120));

    expect(shortName).toBe("5.6cqh");
    expect(mediumName).toBe("3.8cqh");
    expect(longName).toBe("3cqh");
    expect(longestName).toBe("2.2cqh");
    expect(Number.parseFloat(longestName) * 2.1).toBeGreaterThanOrEqual(4);
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

  it("uses the saved logo size and shape on the guest page and the A5 poster", () => {
    const guest = readFileSync(new URL("../../app/e/[code]/page.tsx", import.meta.url), "utf8");
    const qr = readFileSync(
      new URL("../../app/[locale]/events/[id]/qr/page.tsx", import.meta.url),
      "utf8",
    );
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
    const screen = 'logoImageClass(event.logoSize, event.logoCorner, "screen")';
    const print = 'logoImageClass(event.logoSize, event.logoCorner, "print")';

    expect(guest).toContain(screen);
    expect(qr).toContain(print);
    expect(qr).toContain("eventFontFamily(event.titleFont)");
    expect(qr).toContain("posterTitleSize(event.name)");
    expect(qr).toContain("signedObjectUrl(event.coverKey)");
    expect(qr).toContain("formatCalendarDate(calendarDateFromDb(event.eventDate), locale)");
    expect(qr).toContain("qr-poster-cover");
    expect(qr).not.toContain("guestFont");
    expect(qr).toContain("`/api/events/${event.id}/qr`");
    expect(qr).toContain('t("qrPosterCta")');
    expect(qr).toContain("print:hidden");
    expect(qr).toContain("qr-poster");
    expect(qr).not.toContain("100vh");
    expect(css).toContain("size: A5 portrait;");
    expect(css).toContain("margin: 0;");
    expect(css).toContain("width: 148mm;");
    expect(css).toContain("height: 210mm;");
    expect(css).toContain("box-sizing: border-box;");
    expect(css).toContain("aspect-ratio: 148 / 210;");
    expect(css).toContain(".qr-poster-cover");
    expect(css).toContain("border-radius: 50%;");
    expect(css).toContain("object-fit: cover;");
    expect(css).not.toContain("qr-poster-ornament");
  });

  it("sends a new event to the event list and offers the same image slots as edit", () => {
    expect(pathAfterEventCreated()).toBe("/events");
    expect(brandingSlots).toEqual(["cover", "logo", "background"]);
  });
});
