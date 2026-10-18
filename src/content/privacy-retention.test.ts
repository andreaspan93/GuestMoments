import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { privacyCopy } from "@/content/privacy-copy";

function pages(language: "en" | "el") {
  return Object.values(privacyCopy[language].documents)
    .flatMap((page) => page.sections)
    .flatMap((section) => section.paragraphs)
    .join("\n");
}

describe("privacy retention copy", () => {
  it("describes administrator access expiry in English and Greek", () => {
    const english = pages("en");
    const greek = pages("el");

    expect(english).not.toMatch(/couple chooses 30, 60, or 90/i);
    expect(english).not.toMatch(/couple or an administrator can choose/i);
    expect(greek).not.toContain("Το ζευγάρι επιλέγει 30, 60 ή 90");
    expect(greek).not.toContain("το ζευγάρι ή ο διαχειριστής μπορεί να επιλέξει άλλη");

    for (const text of [english, greek]) {
      expect(text).toMatch(/30, 60, 90, 180|30, 60, 90, 180 ή 365/);
      expect(text.toLowerCase()).toMatch(/disabled|απενεργοποιημέν/);
    }

    expect(english).toContain("The couple does not choose a retention period for each event.");
    expect(english).toContain("The customer account remains and stays disabled.");
    expect(english).toContain("cannot guarantee that every copy is erased at once");
    expect(greek).toContain("Το ζευγάρι δεν επιλέγει διάρκεια φύλαξης για κάθε εκδήλωση.");
    expect(greek).toContain("Ο λογαριασμός του πελάτη παραμένει και μένει απενεργοποιημένος.");
    expect(greek).toContain("δεν μπορεί να εγγυηθεί ότι κάθε αντίγραφο σβήνεται αμέσως");
  });

  it("does not render a retention control on the customer event form", () => {
    const source = readFileSync("src/components/event-form.tsx", "utf8");

    expect(source).not.toContain("RetentionField");
    expect(source).not.toContain("retentionDays");
    expect(source).not.toContain("How long photos are kept");
  });
});
