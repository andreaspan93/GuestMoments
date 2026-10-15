import {
  Alegreya_Sans,
  EB_Garamond,
  Literata,
  Noto_Sans,
  Noto_Serif,
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

export const guestFontVariables = [
  notoSans.variable,
  notoSerif.variable,
  sourceSans.variable,
  alegreyaSans.variable,
  literata.variable,
  ebGaramond.variable,
].join(" ");
