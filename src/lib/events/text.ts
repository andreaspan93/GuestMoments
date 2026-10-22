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

export function guestLocaleFromQuery(value: string | string[] | undefined): GuestLocale | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (raw === "en" || raw === "el") {
    return raw;
  }

  return null;
}

export const guestChrome = {
  el: {
    language: "Γλώσσα",
    greek: "Ελληνικά",
    english: "English",
    instructions: "Οδηγίες",
    unavailable: "Αυτή η εκδήλωση δεν είναι διαθέσιμη.",
    uploadTitle: "Μοιραστείτε τις στιγμές σας",
    uploadPick: "Φωτογραφίες και βίντεο",
    guestName: "Το όνομά σας (προαιρετικό)",
    guestMessage: "Μήνυμα (προαιρετικό)",
    uploadSubmit: "Ανέβασμα",
    uploadPending: "Ανέβασμα…",
    uploadDone: "Ανέβηκε",
    uploadSuccess: "Όλες οι φωτογραφίες ανέβηκαν με επιτυχία!",
    uploadFailed: "Το ανέβασμα δεν ολοκληρώθηκε.",
    uploadWaiting: "Σε αναμονή",
    uploadPreparing: "Προετοιμασία…",
    uploadRetry: "Δοκιμή ξανά",
    uploadOf: "από",
    uploadPartial: "Ορισμένα αρχεία δεν ανέβηκαν.",
    uploadQuota: "Ο χώρος της εκδήλωσης γέμισε.",
    uploadType: "Επιτρέπονται jpeg, png, webp, mp4 και mov.",
    uploadOversize: "Το αρχείο είναι μεγαλύτερο από το επιτρεπτό.",
    uploadRate: "Πολλά ανεβάσματα μαζί. Δοκιμάστε ξανά σε λίγο.",
    galleryTitle: "Στιγμές",
    galleryEmpty: "Δεν υπάρχουν φωτογραφίες ακόμα.",
    video: "Βίντεο",
    download: "Λήψη",
    deleteOwn: "Διαγραφή",
    deleteOwnConfirm: "Να διαγραφεί αυτό το αρχείο;",
    select: "Επιλογή",
    selectAll: "Επιλογή όλων",
    deleteSelected: "Διαγραφή επιλεγμένων",
    deleteSelectedConfirm: "Να διαγραφούν τα επιλεγμένα αρχεία;",
    deleteFailed: "Η διαγραφή δεν ολοκληρώθηκε.",
    close: "Κλείσιμο",
    uploadChoose: "Επιλογή αρχείων",
    uploadCount: "αρχεία επιλεγμένα",
    previous: "Προηγούμενη φωτογραφία",
    next: "Επόμενη φωτογραφία",
    cannotPlay: "Αυτό το βίντεο δεν αναπαράγεται σε αυτόν τον browser. Μπορείτε να το κατεβάσετε.",
    privacyLead: "Πριν ανεβάσετε, διαβάστε ποια στοιχεία και φωτογραφίες επεξεργάζεται αυτή η σελίδα.",
    privacyLink: "Ενημέρωση απορρήτου για καλεσμένους",
    cookieSettings: "Ρυθμίσεις cookies",
  },
  en: {
    language: "Language",
    greek: "Ελληνικά",
    english: "English",
    instructions: "Instructions",
    unavailable: "This event is not available.",
    uploadTitle: "Share your moments",
    uploadPick: "Photos and videos",
    guestName: "Your name (optional)",
    guestMessage: "Message (optional)",
    uploadSubmit: "Upload",
    uploadPending: "Uploading…",
    uploadDone: "Uploaded",
    uploadSuccess: "All photos uploaded successfully!",
    uploadFailed: "The upload did not finish.",
    uploadWaiting: "Waiting",
    uploadPreparing: "Preparing…",
    uploadRetry: "Try again",
    uploadOf: "of",
    uploadPartial: "Some files were not uploaded.",
    uploadQuota: "This event has no storage left.",
    uploadType: "Use jpeg, png, webp, mp4, or mov.",
    uploadOversize: "That file is larger than the limit.",
    uploadRate: "Too many uploads. Try again shortly.",
    galleryTitle: "Moments",
    galleryEmpty: "No photos yet.",
    video: "Video",
    download: "Download",
    deleteOwn: "Delete",
    deleteOwnConfirm: "Delete this file?",
    select: "Select",
    selectAll: "Select all",
    deleteSelected: "Delete selected",
    deleteSelectedConfirm: "Delete the selected files?",
    deleteFailed: "The delete did not finish.",
    close: "Close",
    uploadChoose: "Choose files",
    uploadCount: "files selected",
    previous: "Previous photo",
    next: "Next photo",
    cannotPlay: "This video cannot play in this browser. You can still download it.",
    privacyLead: "Before you upload, read what this page processes about you and the photos.",
    privacyLink: "Guest privacy notice",
    cookieSettings: "Cookie settings",
  },
} as const;
