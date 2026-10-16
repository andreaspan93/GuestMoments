import {
  Alegreya_Sans,
  Allura,
  Cormorant_Garamond,
  EB_Garamond,
  Great_Vibes,
  Literata,
  Montserrat,
  Noto_Sans,
  Noto_Serif,
  Playfair_Display,
  Source_Sans_3,
} from "next/font/google";

const notoSans = Noto_Sans({
  subsets: ["latin", "greek"],
  variable: "--font-noto-sans",
});

const notoSerif = Noto_Serif({
  subsets: ["latin", "greek"],
  variable: "--font-noto-serif",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin", "greek"],
  variable: "--font-source-sans-3",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--font-alegreya-sans",
});

const literata = Literata({
  subsets: ["latin", "greek"],
  variable: "--font-literata",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin", "greek"],
  variable: "--font-eb-garamond",
});

const greatVibes = Great_Vibes({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-great-vibes",
});

const allura = Allura({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-allura",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-playfair-display",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-cormorant-garamond",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-montserrat",
});

export const guestFontVariables = [
  notoSans.variable,
  notoSerif.variable,
  sourceSans.variable,
  alegreyaSans.variable,
  literata.variable,
  ebGaramond.variable,
  greatVibes.variable,
  allura.variable,
  playfairDisplay.variable,
  cormorantGaramond.variable,
  montserrat.variable,
].join(" ");
