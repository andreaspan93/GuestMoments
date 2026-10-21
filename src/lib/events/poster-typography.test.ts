import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  defaultPosterTypography,
  posterTypographyForTitle,
  posterTypographySchema,
  resolvePosterTypography,
} from "@/lib/events/poster-typography";

describe("poster typography", () => {
  it("starts from the current poster fonts and ignores the guest page until a poster save", () => {
    expect(resolvePosterTypography(null)).toEqual(defaultPosterTypography);
    expect(defaultPosterTypography.nameFont).toBe("alegreya");
    expect(defaultPosterTypography.nameSizeMm).toBe(16.8);
    expect(defaultPosterTypography.dateFont).toBe("noto-sans");
    expect(defaultPosterTypography.dateSizeMm).toBe(6.2);
    expect(defaultPosterTypography.kickerFont).toBe("noto-sans");
    expect(defaultPosterTypography.kickerSizeMm).toBe(9.24);
    expect(defaultPosterTypography.scriptFont).toBe("mynerve");
    expect(defaultPosterTypography.scriptSizeMm).toBe(17.64);
    expect(posterTypographyForTitle("literata").nameFont).toBe("literata");
    expect(posterTypographyForTitle("great-vibes").nameFont).toBe("gfs-didot");
    expect(posterTypographyForTitle("literata").dateFont).toBe(defaultPosterTypography.dateFont);
  });

  it("accepts the supported fonts and sizes and rejects anything else", () => {
    const saved = {
      nameFont: "playpen-sans",
      nameSizeMm: 12,
      dateFont: "eb-garamond",
      dateSizeMm: 5,
      kickerFont: "literata",
      kickerSizeMm: 8,
      scriptFont: "mansalva",
      scriptSizeMm: 20,
    };

    expect(posterTypographySchema.safeParse(saved).success).toBe(true);
    expect(resolvePosterTypography(saved)).toEqual(saved);
    expect(posterTypographySchema.safeParse({ ...saved, nameFont: "comic-sans" }).success).toBe(false);
    expect(posterTypographySchema.safeParse({ ...saved, dateSizeMm: 2 }).success).toBe(false);
    expect(posterTypographySchema.safeParse({ ...saved, scriptSizeMm: 40 }).success).toBe(false);
    expect(posterTypographySchema.safeParse({ ...saved, guestFont: "noto-sans" }).success).toBe(false);
    expect(resolvePosterTypography({ ...saved, nameFont: "playfair-display" }).nameFont).toBe("alegreya");
  });

  it("keeps poster typography off the guest page and out of the guest-font update", () => {
    const guest = readFileSync(new URL("../../app/e/[code]/page.tsx", import.meta.url), "utf8");
    const service = readFileSync(new URL("./service.ts", import.meta.url), "utf8");
    const update = service.slice(
      service.indexOf("export async function updateCustomerEvent"),
      service.indexOf("export async function updatePosterTypography"),
    );
    const posterUpdate = service.slice(
      service.indexOf("export async function updatePosterTypography"),
      service.indexOf("export async function updateLogoPlacement"),
    );

    expect(guest).not.toContain("posterTypography");
    expect(guest).toContain("eventFontFamily(event.titleFont)");
    expect(update).not.toContain("posterTypography");
    expect(update).toContain("titleFont: input.titleFont");
    expect(posterUpdate).toContain("posterTypography: parsed.data");
    expect(posterUpdate).not.toContain("titleFont:");
    expect(posterUpdate).not.toContain("guestFont:");
    expect(service).toContain("...eventScope(actor)");
  });

  it("keeps the poster font menus closed until they are clicked", () => {
    const dialog = readFileSync(new URL("../../components/poster-typography-dialog.tsx", import.meta.url), "utf8");

    expect(dialog).toContain("useState<FontKey | null>(null)");
    expect(dialog).toContain('aria-haspopup="listbox"');
    expect(dialog).toContain("aria-expanded={open}");
    expect(dialog).toContain('role="listbox"');
    expect(dialog).toContain("fontFamily: font.family");
    expect(dialog).toContain("fontWeight: font.weight");
    expect(dialog).not.toContain("<select");
    expect(dialog).toContain("qrTypographyDecrease");
    expect(dialog).toContain("qrTypographyIncrease");
    expect(dialog).toContain("changeSize(row.size, -0.1)");
    expect(dialog).toContain("changeSize(row.size, 0.1)");
    expect(dialog).toContain("posterSizeMinMm");
    expect(dialog).toContain("posterSizeMaxMm");
    expect(dialog).toContain("grid-cols-[minmax(0,1fr)_auto]");
  });
});
