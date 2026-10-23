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

    expect(panel).toContain("<PosterTypographyDialog");
    expect(panel).toContain('useState<QrDesign>("a")');
    expect(panel).toContain('setDesign("a")');
    expect(panel).toContain('setDesign("b")');
    expect(panel).toContain('setDesign("c")');
    expect(panel).toContain('design === "a" ?');
    expect(page).not.toContain("font-mono");
    expect(page).not.toContain("guestEventUrl");
    expect(panel).not.toContain("Chrissy");
    expect(panel).not.toContain("Thomas");
  });

  it("renders Design B from the event name and date", () => {
    const panel = readFileSync(new URL("../../components/qr-design-panel.tsx", import.meta.url), "utf8");

    expect(panel.match(/textStyle\(typography\.nameFont, sizes\.name\)/g)).toHaveLength(3);
    expect(panel.match(/textStyle\(typography\.dateFont, sizes\.date\)/g)).toHaveLength(3);
    expect(panel).toContain("textStyle(typography.kickerFont, sizes.kicker)");
    expect(panel).toContain("textStyle(typography.scriptFont, sizes.script)");
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

    expect(panel.match(/<QrMark src=\{qrSrc\}/g)).toHaveLength(3);
    expect(panel).toContain("downloadPosterPng(node, design)");
    expect(panel).toContain("data-qr-design={design}");
    expect(panel).toContain("data-poster-download={design}");
    expect(panel).toContain("posterPdfPath(eventId, locale, design, option.paper)");
    expect(panel).toContain('t("downloadPdf")');
    expect(panel).toContain('aria-haspopup="menu"');
    expect(panel).toContain('paper: "a7"');
    expect(panel).toContain('paper: "a8"');
    expect(panel).toContain("grid-cols-2");
    expect(panel).not.toContain("<PrintButton");
    expect(panel).toContain('design === "c" ? cardPdfOptions');
    expect(parseQrDesign(null)).toBe("a");
    expect(parseQrDesign("b")).toBe("b");
    expect(parseQrDesign("c")).toBe("c");
    expect(parseQrDesign("other")).toBe("a");
    expect(posterPdfPath("event-1", "el", "a")).toBe("/api/events/event-1/poster?locale=el&design=a");
    expect(posterPdfPath("event-1", "en", "b")).toBe("/api/events/event-1/poster?locale=en&design=b");
    expect(posterPdfPath("event-1", "en", "b", "a7")).toBe(
      "/api/events/event-1/poster?locale=en&design=b&paper=a7",
    );
    expect(posterPdfPath("event-1", "en", "c")).toBe(
      "/api/events/event-1/poster?locale=en&design=c&paper=a8",
    );
    expect(posterPdfPath("event-1", "en", "c", "a5")).toBe(
      "/api/events/event-1/poster?locale=en&design=c&paper=a8",
    );
    expect(route).toContain("paperForDesign");
    expect(route).toContain("fitPosterPdfToA7");
    expect(route).toContain("buildCardPosterPdf");
    expect(posterPngFilename("a")).toBe("guestmoments-share.png");
    expect(posterPngFilename("b")).toBe("guestmoments-poster.png");
    expect(posterPngFilename("c")).toBe("guestmoments-card.png");
    expect(route).toContain("renderEventQr(guestEventUrl(event.uniqueCode))");
    expect(route).toContain("resolvePosterTypography(event.posterTypography)");
    expect(route).not.toContain("titleFont: event.titleFont");
    expect(route).toContain("buildPosterPdf");
    expect(route).toContain("buildSharePosterPdf");
    expect(route).toContain('design === "b"');
    expect(route.match(/guestEventUrl\(event\.uniqueCode\)/g)).toHaveLength(1);
    expect(css).toContain("width: min(100mm, 100%);");
    expect(css).toContain("width: min(74mm, 100%);");
    expect(css).toContain("aspect-ratio: 74 / 52;");
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
