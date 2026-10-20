import { z } from "zod";
import { defaultLogoSize, isLogoSize, type LogoSize } from "@/lib/events/appearance";

export const logoScaleMin = 1;
export const logoScaleMax = 3;

/** Guest card content width: max-w-lg minus the card's horizontal padding. */
export const guestLogoMaxWidth = 464;

export const defaultLogoPlacement = {
  scale: logoScaleMin,
  x: 0,
  y: 0,
} as const;

export type LogoPlacement = {
  scale: number;
  x: number;
  y: number;
};

export type LogoFrame = {
  width: number;
  height: number;
  rounded: boolean;
};

const screenHeights: Record<LogoSize, { compact: number; wide: number }> = {
  small: { compact: 96, wide: 128 },
  medium: { compact: 144, wide: 192 },
  large: { compact: 192, wide: 256 },
  "extra-large": { compact: 240, wide: 320 },
};

export const logoPlacementSchema = z.strictObject({
  scale: z.number().finite().min(logoScaleMin).max(logoScaleMax),
  x: z.number().finite().min(-8).max(8),
  y: z.number().finite().min(-8).max(8),
});

export function hasLogoPlacement(scale: number | null | undefined) {
  return typeof scale === "number" && Number.isFinite(scale);
}

export function logoScreenHeight(size: string, wide: boolean) {
  const known = isLogoSize(size) ? size : defaultLogoSize;
  return wide ? screenHeights[known].wide : screenHeights[known].compact;
}

export function logoFrameSize(input: {
  size: string;
  corner: string;
  wide: boolean;
  maxWidth: number;
  image: { width: number; height: number } | null;
}): LogoFrame | null {
  const maxWidth = Math.min(guestLogoMaxWidth, input.maxWidth);

  if (maxWidth <= 0) {
    return null;
  }

  const heightLimit = logoScreenHeight(input.size, input.wide);

  if (input.corner === "rounded") {
    const side = Math.min(heightLimit, maxWidth);
    return { width: side, height: side, rounded: true };
  }

  if (!input.image || input.image.width <= 0 || input.image.height <= 0) {
    return null;
  }

  const naturalWidth = heightLimit * (input.image.width / input.image.height);

  return {
    width: Math.min(maxWidth, naturalWidth),
    height: heightLimit,
    rounded: false,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function clampPlacementToFrame(
  frame: { width: number; height: number },
  image: { width: number; height: number },
  placement: LogoPlacement,
): LogoPlacement {
  const scale = clamp(placement.scale, logoScaleMin, logoScaleMax);

  if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { scale, x: 0, y: 0 };
  }

  const contain = Math.min(frame.width / image.width, frame.height / image.height);
  const drawW = image.width * contain * scale;
  const drawH = image.height * contain * scale;
  const minVisibleX = Math.min(drawW, frame.width) * 0.25;
  const minVisibleY = Math.min(drawH, frame.height) * 0.25;
  const centeredLeft = (frame.width - drawW) / 2;
  const centeredTop = (frame.height - drawH) / 2;
  const left = clamp(
    centeredLeft + placement.x * frame.width,
    minVisibleX - drawW,
    frame.width - minVisibleX,
  );
  const top = clamp(
    centeredTop + placement.y * frame.height,
    minVisibleY - drawH,
    frame.height - minVisibleY,
  );

  return {
    scale,
    x: (left - centeredLeft) / frame.width,
    y: (top - centeredTop) / frame.height,
  };
}

export function logoImageBox(
  frame: { width: number; height: number },
  image: { width: number; height: number },
  placement: LogoPlacement,
) {
  const fitted = clampPlacementToFrame(frame, image, placement);
  const contain = Math.min(frame.width / image.width, frame.height / image.height);
  const width = image.width * contain * fitted.scale;
  const height = image.height * contain * fitted.scale;

  return {
    left: (frame.width - width) / 2 + fitted.x * frame.width,
    top: (frame.height - height) / 2 + fitted.y * frame.height,
    width,
    height,
    placement: fitted,
  };
}
