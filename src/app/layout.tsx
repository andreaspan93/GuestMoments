import type { Metadata } from "next";
import { Noto_Sans } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const notoSans = Noto_Sans({
  variable: "--font-noto-sans",
  subsets: ["latin", "greek"],
});

export const metadata: Metadata = {
  title: "GuestMoments",
  description:
    "Guests upload wedding photos and videos from their phones, without an account.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const locale = headerStore.get("x-next-intl-locale") ?? "el";

  return (
    <html lang={locale} className={`${notoSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
