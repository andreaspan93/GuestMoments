import {
  Alegreya,
  Alegreya_Sans,
  Brygada_1918,
  EB_Garamond,
  GFS_Didot,
  Literata,
  Noto_Sans,
  Noto_Serif,
  Source_Sans_3,
  Source_Serif_4,
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

const sourceSerif = Source_Serif_4({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-source-serif-4",
});

const alegreyaSans = Alegreya_Sans({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-alegreya-sans",
});

const alegreya = Alegreya({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-alegreya",
});

const literata = Literata({
  subsets: ["latin", "greek"],
  variable: "--font-literata",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin", "greek"],
  variable: "--font-eb-garamond",
});

const brygada = Brygada_1918({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-brygada-1918",
});

const gfsDidot = GFS_Didot({
  subsets: ["latin", "greek"],
  weight: "400",
  variable: "--font-gfs-didot",
});

export const guestFontVariables = [
  notoSans.variable,
  notoSerif.variable,
  sourceSans.variable,
  sourceSerif.variable,
  alegreyaSans.variable,
  alegreya.variable,
  literata.variable,
  ebGaramond.variable,
  brygada.variable,
  gfsDidot.variable,
].join(" ");
