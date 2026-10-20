import { describe, expect, it } from "vitest";
import {
  clampPlacementToFrame,
  defaultLogoPlacement,
  guestLogoMaxWidth,
  hasLogoPlacement,
  logoFrameSize,
  logoImageBox,
  logoScaleMax,
  logoScaleMin,
} from "./logo-placement";

const portrait = { width: 300, height: 600 };
const landscape = { width: 600, height: 300 };
const square = { width: 400, height: 400 };
const transparentWide = { width: 1200, height: 400 };

function box(
  image: { width: number; height: number },
  corner: "square" | "rounded",
  placement = defaultLogoPlacement,
) {
  const frame = logoFrameSize({
    size: "medium",
    corner,
    wide: false,
    maxWidth: 400,
    image,
  });

  if (!frame) {
    throw new Error("frame");
  }

  return { frame, drawn: logoImageBox(frame, image, placement) };
}

describe("logo placement", () => {
  it("fits a portrait, landscape, square, and wide logo inside the frame at the default scale", () => {
    for (const image of [portrait, landscape, square, transparentWide]) {
      const { frame, drawn } = box(image, "square");

      expect(drawn.left).toBeGreaterThanOrEqual(-0.01);
      expect(drawn.top).toBeGreaterThanOrEqual(-0.01);
      expect(drawn.left + drawn.width).toBeLessThanOrEqual(frame.width + 0.01);
      expect(drawn.top + drawn.height).toBeLessThanOrEqual(frame.height + 0.01);
      expect(drawn.width / drawn.height).toBeCloseTo(image.width / image.height);
    }
  });

  it("uses the guest logo height for square corners and a square frame for rounded corners", () => {
    const straight = logoFrameSize({
      size: "medium",
      corner: "square",
      wide: false,
      maxWidth: 400,
      image: portrait,
    });
    const round = logoFrameSize({
      size: "medium",
      corner: "rounded",
      wide: true,
      maxWidth: 800,
      image: landscape,
    });

    expect(straight).toEqual({ width: 72, height: 144, rounded: false });
    expect(round).toEqual({ width: 192, height: 192, rounded: true });
    expect(guestLogoMaxWidth).toBe(464);
  });

  it("zooms without changing the aspect ratio and keeps the image partly visible", () => {
    const frame = { width: 144, height: 144 };
    const zoomed = logoImageBox(frame, landscape, { scale: 2, x: 0, y: 0 });
    const fitted = logoImageBox(frame, landscape, defaultLogoPlacement);

    expect(zoomed.width).toBeCloseTo(fitted.width * 2);
    expect(zoomed.height).toBeCloseTo(fitted.height * 2);
    expect(zoomed.width / zoomed.height).toBeCloseTo(landscape.width / landscape.height);

    const pushed = clampPlacementToFrame(frame, landscape, { scale: 2, x: 20, y: -20 });
    const drawn = logoImageBox(frame, landscape, pushed);
    const overlapX =
      Math.min(drawn.left + drawn.width, frame.width) - Math.max(drawn.left, 0);
    const overlapY =
      Math.min(drawn.top + drawn.height, frame.height) - Math.max(drawn.top, 0);

    expect(overlapX).toBeGreaterThan(frame.width * 0.2);
    expect(overlapY).toBeGreaterThan(0);
    expect(pushed.x).toBeLessThan(20);
    expect(pushed.y).toBeGreaterThan(-20);
  });

  it("limits the scale and treats missing settings as the legacy logo", () => {
    const frame = { width: 144, height: 144 };
    const low = clampPlacementToFrame(frame, square, { scale: 0.2, x: 0, y: 0 });
    const high = clampPlacementToFrame(frame, square, { scale: 9, x: 0, y: 0 });

    expect(low.scale).toBe(logoScaleMin);
    expect(high.scale).toBe(logoScaleMax);
    expect(hasLogoPlacement(null)).toBe(false);
    expect(hasLogoPlacement(undefined)).toBe(false);
    expect(hasLogoPlacement(1)).toBe(true);
  });
});
