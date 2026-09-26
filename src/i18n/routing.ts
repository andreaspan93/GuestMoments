import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["el", "en"],
  defaultLocale: "el",
  localePrefix: "as-needed",
});

export function isGuestEventPath(pathname: string) {
  return pathname === "/e" || pathname.startsWith("/e/");
}
