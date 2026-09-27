export type GuestLocale = "el" | "en";

export function guestText(locale: GuestLocale, greek: string, english: string) {
  if (locale === "en" && english.trim()) {
    return english;
  }

  return greek;
}

export function guestLocaleFromCookie(value: string | undefined): GuestLocale {
  return value === "en" ? "en" : "el";
}

export const guestChrome = {
  el: {
    language: "Γλώσσα",
    greek: "Ελληνικά",
    english: "English",
    instructions: "Οδηγίες",
    unavailable: "Αυτή η εκδήλωση δεν είναι διαθέσιμη.",
  },
  en: {
    language: "Language",
    greek: "Ελληνικά",
    english: "English",
    instructions: "Instructions",
    unavailable: "This event is not available.",
  },
} as const;
