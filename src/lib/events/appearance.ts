export const eventFontIds = [
  "noto-sans",
  "noto-serif",
  "source-sans",
  "alegreya-sans",
  "literata",
  "eb-garamond",
] as const;

export type EventFontId = (typeof eventFontIds)[number];

export const defaultEventFont: EventFontId = "noto-sans";

export const eventFonts: ReadonlyArray<{
  id: EventFontId;
  label: string;
  family: string;
}> = [
  { id: "noto-sans", label: "Noto Sans", family: 'var(--font-noto-sans), "Noto Sans", sans-serif' },
  { id: "noto-serif", label: "Noto Serif", family: 'var(--font-noto-serif), "Noto Serif", serif' },
  { id: "source-sans", label: "Source Sans 3", family: 'var(--font-source-sans-3), "Source Sans 3", sans-serif' },
  { id: "alegreya-sans", label: "Alegreya Sans", family: 'var(--font-alegreya-sans), "Alegreya Sans", sans-serif' },
  { id: "literata", label: "Literata", family: 'var(--font-literata), Literata, serif' },
  { id: "eb-garamond", label: "EB Garamond", family: 'var(--font-eb-garamond), "EB Garamond", serif' },
];

export const logoSizes = ["small", "medium", "large", "extra-large"] as const;

export type LogoSize = (typeof logoSizes)[number];

export const defaultLogoSize: LogoSize = "medium";

export const logoCorners = ["rounded", "square"] as const;

export type LogoCorner = (typeof logoCorners)[number];

export const defaultLogoCorner: LogoCorner = "square";

export const defaultEventAppearance = {
  titleFont: defaultEventFont,
  guestFont: defaultEventFont,
  logoSize: defaultLogoSize,
  logoCorner: defaultLogoCorner,
} as const;

const logoClasses = {
  small: {
    screen: "h-24 w-auto max-w-full shrink-0 self-center object-contain sm:h-32",
    print: "h-[12.5cqh] max-h-[26mm] w-auto max-w-full shrink-0 self-center object-contain",
  },
  medium: {
    screen: "h-36 w-auto max-w-full shrink-0 self-center object-contain sm:h-48",
    print: "h-[16cqh] max-h-[34mm] w-auto max-w-full shrink-0 self-center object-contain",
  },
  large: {
    screen: "h-48 w-auto max-w-full shrink-0 self-center object-contain sm:h-64",
    print: "h-[19cqh] max-h-[40mm] w-auto max-w-full shrink-0 self-center object-contain",
  },
  "extra-large": {
    screen: "h-60 w-auto max-w-full shrink-0 self-center object-contain sm:h-80",
    print: "h-[22cqh] max-h-[46mm] w-auto max-w-full shrink-0 self-center object-contain",
  },
} as const;

const logoCircleClasses = {
  small: {
    screen: "aspect-square h-auto w-24 max-w-full shrink-0 self-center sm:w-32",
    print: "aspect-square h-auto w-[12.5cqh] max-h-[26mm] max-w-[26mm] shrink-0 self-center",
  },
  medium: {
    screen: "aspect-square h-auto w-36 max-w-full shrink-0 self-center sm:w-48",
    print: "aspect-square h-auto w-[16cqh] max-h-[34mm] max-w-[34mm] shrink-0 self-center",
  },
  large: {
    screen: "aspect-square h-auto w-48 max-w-full shrink-0 self-center sm:w-64",
    print: "aspect-square h-auto w-[19cqh] max-h-[40mm] max-w-[40mm] shrink-0 self-center",
  },
  "extra-large": {
    screen: "aspect-square h-auto w-60 max-w-full shrink-0 self-center sm:w-80",
    print: "aspect-square h-auto w-[22cqh] max-h-[46mm] max-w-[46mm] shrink-0 self-center",
  },
} as const;

export function isEventFontId(value: string): value is EventFontId {
  return eventFontIds.some((id) => id === value);
}

export function isLogoSize(value: string): value is LogoSize {
  return logoSizes.some((size) => size === value);
}

export function isLogoCorner(value: string): value is LogoCorner {
  return logoCorners.some((corner) => corner === value);
}

export function eventFontFamily(value: string) {
  const match = eventFonts.find((font) => font.id === value);
  return match?.family ?? eventFonts[0].family;
}

export function logoSizeClass(value: string, surface: "screen" | "print") {
  const size = isLogoSize(value) ? value : defaultLogoSize;
  return logoClasses[size][surface];
}

export function logoCornerClass(value: string) {
  return value === "rounded" ? "overflow-hidden rounded-full object-cover" : "rounded-none";
}

export function logoImageClass(size: string, corner: string, surface: "screen" | "print") {
  if (corner === "rounded") {
    const known = isLogoSize(size) ? size : defaultLogoSize;
    return `${logoCircleClasses[known][surface]} ${logoCornerClass(corner)}`;
  }

  return `${logoSizeClass(size, surface)} ${logoCornerClass(corner)}`;
}
