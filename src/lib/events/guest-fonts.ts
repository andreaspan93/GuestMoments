import {
  Alegreya_Sans,
  Allura,
  Cinzel,
  Cormorant_Garamond,
  DM_Serif_Display,
  EB_Garamond,
  Great_Vibes,
  Libre_Baskerville,
  Literata,
  Montserrat,
  Noto_Sans,
  Noto_Serif,
  Parisienne,
  Pinyon_Script,
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

const parisienne = Parisienne({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-parisienne",
});

const pinyonScript = Pinyon_Script({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-pinyon-script",
});

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: "600",
  variable: "--font-cinzel",
});

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-serif-display",
});

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-libre-baskerville",
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
  parisienne.variable,
  pinyonScript.variable,
  cinzel.variable,
  dmSerifDisplay.variable,
  libreBaskerville.variable,
].join(" ");
