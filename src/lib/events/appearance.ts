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

export const logoSizes = ["small", "medium", "large"] as const;

export type LogoSize = (typeof logoSizes)[number];

export const defaultLogoSize: LogoSize = "medium";

export const defaultEventAppearance = {
  titleFont: defaultEventFont,
  guestFont: defaultEventFont,
  logoSize: defaultLogoSize,
} as const;

const logoClasses = {
  small: {
    screen: "h-12 w-auto max-w-full object-contain",
    print: "mt-6 h-20 w-auto max-w-[48mm] object-contain",
  },
  medium: {
    screen: "h-16 w-auto max-w-full object-contain",
    print: "mt-6 h-28 w-auto max-w-[70mm] object-contain",
  },
  large: {
    screen: "h-24 w-auto max-w-full object-contain sm:h-32",
    print: "mt-6 h-36 w-auto max-w-[90mm] object-contain",
  },
} as const;

export function isEventFontId(value: string): value is EventFontId {
  return eventFontIds.some((id) => id === value);
}

export function isLogoSize(value: string): value is LogoSize {
  return logoSizes.some((size) => size === value);
}

export function eventFontFamily(value: string) {
  const match = eventFonts.find((font) => font.id === value);
  return match?.family ?? eventFonts[0].family;
}

export function logoSizeClass(value: string, surface: "screen" | "print") {
  const size = isLogoSize(value) ? value : defaultLogoSize;
  return logoClasses[size][surface];
}
