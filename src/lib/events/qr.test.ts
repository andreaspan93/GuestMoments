import { describe, expect, it } from "vitest";
import { QR_ERROR_CORRECTION, renderEventQr } from "./qr";

describe("event qr", () => {
  it("renders a print-sized png with high error correction", async () => {
    expect(QR_ERROR_CORRECTION).toBe("H");

    const png = await renderEventQr("http://localhost:3000/e/abc");

    expect(png.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(png.length).toBeGreaterThan(500);
  });
});
