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
    uploadTitle: "Ανεβάστε στιγμές",
    uploadPick: "Φωτογραφίες και βίντεο",
    guestName: "Το όνομά σας (προαιρετικό)",
    guestMessage: "Μήνυμα (προαιρετικό)",
    uploadSubmit: "Ανέβασμα",
    uploadPending: "Ανέβασμα…",
    uploadDone: "Ανέβηκε",
    uploadFailed: "Το ανέβασμα δεν ολοκληρώθηκε.",
    uploadQuota: "Ο χώρος της εκδήλωσης γέμισε.",
    uploadType: "Επιτρέπονται jpeg, png, webp, mp4 και mov.",
    uploadOversize: "Το αρχείο είναι μεγαλύτερο από το επιτρεπτό.",
    uploadRate: "Πολλά ανεβάσματα μαζί. Δοκιμάστε ξανά σε λίγο.",
    galleryTitle: "Στιγμές",
    galleryEmpty: "Δεν υπάρχουν φωτογραφίες ακόμα.",
    video: "Βίντεο",
    download: "Λήψη",
    close: "Κλείσιμο",
    uploadChoose: "Επιλογή αρχείων",
    uploadEmpty: "Δεν έχει επιλεγεί αρχείο",
    uploadCount: "αρχεία επιλεγμένα",
    previous: "Προηγούμενη φωτογραφία",
    next: "Επόμενη φωτογραφία",
    cannotPlay: "Αυτό το βίντεο δεν αναπαράγεται σε αυτόν τον browser. Μπορείτε να το κατεβάσετε.",
  },
  en: {
    language: "Language",
    greek: "Ελληνικά",
    english: "English",
    instructions: "Instructions",
    unavailable: "This event is not available.",
    uploadTitle: "Upload moments",
    uploadPick: "Photos and videos",
    guestName: "Your name (optional)",
    guestMessage: "Message (optional)",
    uploadSubmit: "Upload",
    uploadPending: "Uploading…",
    uploadDone: "Uploaded",
    uploadFailed: "The upload did not finish.",
    uploadQuota: "This event has no storage left.",
    uploadType: "Use jpeg, png, webp, mp4, or mov.",
    uploadOversize: "That file is larger than the limit.",
    uploadRate: "Too many uploads. Try again shortly.",
    galleryTitle: "Moments",
    galleryEmpty: "No photos yet.",
    video: "Video",
    download: "Download",
    close: "Close",
    uploadChoose: "Choose files",
    uploadEmpty: "No file selected",
    uploadCount: "files selected",
    previous: "Previous photo",
    next: "Next photo",
    cannotPlay: "This video cannot play in this browser. You can still download it.",
  },
} as const;
