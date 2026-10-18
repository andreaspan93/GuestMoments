export const eventFontIds = [
  "mansalva",
  "mynerve",
  "playpen-sans",
  "alegreya",
  "gfs-didot",
  "eb-garamond",
  "brygada-1918",
  "source-serif-4",
  "literata",
  "noto-serif",
  "alegreya-sans",
  "source-sans",
  "noto-sans",
] as const;

export type EventFontId = (typeof eventFontIds)[number];

export const defaultTitleFont: EventFontId = "alegreya";

export const defaultEventFont: EventFontId = "source-sans";

const legacyEventFonts: Record<string, EventFontId> = {
  "great-vibes": "gfs-didot",
  allura: "gfs-didot",
  parisienne: "gfs-didot",
  "pinyon-script": "gfs-didot",
  cinzel: "gfs-didot",
  "playfair-display": "alegreya",
  "cormorant-garamond": "alegreya",
  "dm-serif-display": "source-serif-4",
  "libre-baskerville": "source-serif-4",
  montserrat: "source-sans",
};

export const eventFontGroups = ["handwritten", "classic"] as const;

export type EventFontGroup = (typeof eventFontGroups)[number];

export const eventFonts: ReadonlyArray<{
  id: EventFontId;
  label: string;
  family: string;
  weight: 400 | 600 | 700;
  group: EventFontGroup;
}> = [
  { id: "mansalva", label: "Mansalva", family: 'var(--font-mansalva), Mansalva, cursive', weight: 400, group: "handwritten" },
  { id: "mynerve", label: "Mynerve", family: 'var(--font-mynerve), Mynerve, cursive', weight: 400, group: "handwritten" },
  { id: "playpen-sans", label: "Playpen Sans", family: 'var(--font-playpen-sans), "Playpen Sans", cursive', weight: 400, group: "handwritten" },
  { id: "alegreya", label: "Alegreya", family: 'var(--font-alegreya), Alegreya, serif', weight: 600, group: "classic" },
  { id: "gfs-didot", label: "GFS Didot", family: 'var(--font-gfs-didot), "GFS Didot", serif', weight: 400, group: "classic" },
  { id: "eb-garamond", label: "EB Garamond", family: 'var(--font-eb-garamond), "EB Garamond", serif', weight: 600, group: "classic" },
  { id: "brygada-1918", label: "Brygada 1918", family: 'var(--font-brygada-1918), "Brygada 1918", serif', weight: 600, group: "classic" },
  { id: "source-serif-4", label: "Source Serif 4", family: 'var(--font-source-serif-4), "Source Serif 4", serif', weight: 600, group: "classic" },
  { id: "literata", label: "Literata", family: 'var(--font-literata), Literata, serif', weight: 600, group: "classic" },
  { id: "noto-serif", label: "Noto Serif", family: 'var(--font-noto-serif), "Noto Serif", serif', weight: 600, group: "classic" },
  { id: "alegreya-sans", label: "Alegreya Sans", family: 'var(--font-alegreya-sans), "Alegreya Sans", sans-serif', weight: 700, group: "classic" },
  { id: "source-sans", label: "Source Sans 3", family: 'var(--font-source-sans-3), "Source Sans 3", sans-serif', weight: 600, group: "classic" },
  { id: "noto-sans", label: "Noto Sans", family: 'var(--font-noto-sans), "Noto Sans", sans-serif', weight: 600, group: "classic" },
];

export const logoSizes = ["small", "medium", "large", "extra-large"] as const;

export type LogoSize = (typeof logoSizes)[number];

export const defaultLogoSize: LogoSize = "medium";

export const logoCorners = ["rounded", "square"] as const;

export type LogoCorner = (typeof logoCorners)[number];

export const defaultLogoCorner: LogoCorner = "square";

export const defaultEventAppearance = {
  titleFont: defaultTitleFont,
  guestFont: defaultEventFont,
  welcomeFont: defaultEventFont,
  titleBold: true,
  guestBold: false,
  welcomeBold: false,
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

export function resolveEventFontId(value: string): EventFontId {
  if (isEventFontId(value)) {
    return value;
  }

  return legacyEventFonts[value] ?? "noto-sans";
}

export function isLogoSize(value: string): value is LogoSize {
  return logoSizes.some((size) => size === value);
}

export function isLogoCorner(value: string): value is LogoCorner {
  return logoCorners.some((corner) => corner === value);
}

export function eventFontFamily(value: string) {
  const id = resolveEventFontId(value);
  const match = eventFonts.find((font) => font.id === id);
  return match?.family ?? eventFonts[eventFonts.length - 1].family;
}

export function eventFontWeight(value: string) {
  const id = resolveEventFontId(value);
  const match = eventFonts.find((font) => font.id === id);
  return match?.weight ?? eventFonts[eventFonts.length - 1].weight;
}

export function eventTextWeight(bold: boolean) {
  return bold ? 700 : 400;
}

export function logoSizeClass(value: string, surface: "screen" | "print") {
  const size = isLogoSize(value) ? value : defaultLogoSize;
  return logoClasses[size][surface];
}

export function logoCornerClass(value: string) {
  return value === "rounded" ? "overflow-hidden rounded-full object-cover" : "rounded-none";
}

export const panelStyles = ["solid", "glass", "frosted"] as const;

export type PanelStyle = (typeof panelStyles)[number];

export const defaultPanelStyle: PanelStyle = "solid";

export function isPanelStyle(value: string): value is PanelStyle {
  return panelStyles.some((style) => style === value);
}

export function guestPanelClass(style: string, hasBackgroundImage: boolean) {
  if (!hasBackgroundImage) {
    return "guest-panel-solid";
  }

  if (style === "glass") {
    return "guest-panel-glass";
  }

  if (style === "frosted") {
    return "guest-panel-frosted";
  }

  return "guest-panel-solid";
}

export function logoImageClass(size: string, corner: string, surface: "screen" | "print") {
  if (corner === "rounded") {
    const known = isLogoSize(size) ? size : defaultLogoSize;
    return `${logoCircleClasses[known][surface]} ${logoCornerClass(corner)}`;
  }

  return `${logoSizeClass(size, surface)} ${logoCornerClass(corner)}`;
}
