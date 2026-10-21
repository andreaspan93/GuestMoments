import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPosterDesign } from "@/lib/events/poster-png";
import {
  parseQrDesign,
  posterPdfPath,
  posterPngFilename,
  sharePosterCopy,
  sharePosterDate,
} from "@/lib/events/qr-design";

describe("QR poster designs", () => {
  it("keeps Design A selected until the customer switches", () => {
    const panel = readFileSync(new URL("../../components/qr-design-panel.tsx", import.meta.url), "utf8");
    const page = readFileSync(new URL("../../app/[locale]/events/[id]/qr/page.tsx", import.meta.url), "utf8");

    expect(panel).toContain('useState<QrDesign>("a")');
    expect(panel).toContain('setDesign("a")');
    expect(panel).toContain('setDesign("b")');
    expect(panel).toContain('design === "a" ?');
    expect(page).not.toContain("font-mono");
    expect(page).not.toContain("guestEventUrl");
    expect(panel).not.toContain("Chrissy");
    expect(panel).not.toContain("Thomas");
  });

  it("renders Design B from the event name and date", () => {
    const panel = readFileSync(new URL("../../components/qr-design-panel.tsx", import.meta.url), "utf8");

    expect(panel).toContain('data-poster-text="name"');
    expect(panel).toContain("{event.name}");
    expect(panel).toContain('data-poster-text="share-date"');
    expect(panel).toContain("{event.shareDate}");
    expect(panel).toContain('t("qrShareKicker")');
    expect(panel).toContain('t("qrShareScript")');
    expect(sharePosterDate("2026-06-24", "en")).toBe("06. 24. 2026");
    expect(sharePosterDate("2026-06-24", "el")).toBe("24. 06. 2026");
    expect(sharePosterCopy("en").script).toBe("the love");
    expect(sharePosterCopy("el").script).toBe("την αγάπη");
    expect(sharePosterCopy("en").line1).toBe("SHARE YOUR PHOTOS WITH US!");
  });

  it("points both designs at the same event QR and exports the selected design", () => {
    const panel = readFileSync(new URL("../../components/qr-design-panel.tsx", import.meta.url), "utf8");
    const route = readFileSync(new URL("../../app/api/events/[id]/poster/route.ts", import.meta.url), "utf8");
    const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

    expect(panel.match(/<QrMark src=\{qrSrc\}/g)).toHaveLength(2);
    expect(panel).toContain("downloadPosterPng(node, design)");
    expect(panel).toContain("data-qr-design={design}");
    expect(panel).toContain("data-poster-download={design}");
    expect(panel).toContain("posterPdfPath(event.id, locale, design)");
    expect(panel.indexOf('design === "a" ?')).toBeLessThan(panel.indexOf("<PrintButton"));
    expect(parseQrDesign(null)).toBe("a");
    expect(parseQrDesign("b")).toBe("b");
    expect(parseQrDesign("other")).toBe("a");
    expect(posterPdfPath("event-1", "el", "a")).toBe("/api/events/event-1/poster?locale=el&design=a");
    expect(posterPdfPath("event-1", "en", "b")).toBe("/api/events/event-1/poster?locale=en&design=b");
    expect(posterPngFilename("a")).toBe("guestmoments-poster.png");
    expect(posterPngFilename("b")).toBe("guestmoments-share.png");
    expect(route).toContain("renderEventQr(guestEventUrl(event.uniqueCode))");
    expect(route).toContain("buildPosterPdf");
    expect(route).toContain("buildSharePosterPdf");
    expect(route).toContain('design === "b"');
    expect(route.match(/guestEventUrl\(event\.uniqueCode\)/g)).toHaveLength(1);
    expect(css).toContain("width: min(100mm, 100%);");
    expect(css).toContain("background: #ffffff;");
    expect(css).not.toContain("#f4f4f4");
    expect(readFileSync(new URL("./share-poster-pdf.ts", import.meta.url), "utf8")).toContain("rgb(1, 1, 1)");
    expect(readFileSync(new URL("./poster-png.ts", import.meta.url), "utf8")).toContain('ctx.fillStyle = "#ffffff"');
    expect(css).toContain("width: 148mm;");
    expect(css).toContain("height: 210mm;");
    expect(() => assertPosterDesign("b", "a")).toThrow(/selected design/);
    expect(assertPosterDesign("b", "b")).toBeUndefined();
  });
});
