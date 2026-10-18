export const legalRoutes = [
  { slug: "privacy", href: "/privacy" },
  { slug: "guestPrivacy", href: "/guest-privacy" },
  { slug: "terms", href: "/terms" },
  { slug: "cookies", href: "/cookies" },
  { slug: "removal", href: "/content-removal" },
  { slug: "notice", href: "/legal-notice" },
  { slug: "dpa", href: "/dpa" },
] as const;

export type LegalSlug = (typeof legalRoutes)[number]["slug"];

export const cookieInventory = [
  { id: "consent", name: "gm_consent", category: "necessary" },
  { id: "session", name: "better-auth.session_token", category: "necessary" },
  { id: "guest", name: "gm_guest_<event code>", category: "necessary" },
  { id: "locale", name: "NEXT_LOCALE", category: "necessary" },
  { id: "guestLocale", name: "guest-locale", category: "necessary" },
] as const;

type Section = { heading: string; paragraphs: string[] };
type DocumentCopy = { title: string; description: string; sections: Section[] };

export type PrivacyCopy = {
  draft: string;
  footerLabel: string;
  footerLead: string;
  consent: {
    title: string;
    body: string;
    accept: string;
    reject: string;
    manage: string;
    save: string;
    close: string;
    necessary: string;
    necessaryHelp: string;
    preferences: string;
    preferencesHelp: string;
    unused: string;
  };
  nav: Record<LegalSlug | "cookieSettings", string>;
  cookieColumns: { name: string; category: string; purpose: string; duration: string };
  cookieCategories: { necessary: string; preferences: string };
  cookieRows: Record<(typeof cookieInventory)[number]["id"], { purpose: string; duration: string }>;
  documents: Record<LegalSlug, DocumentCopy>;
};

const en = {
  draft:
    "Draft for the operator and for legal review. It describes this application as it works today. It is not a statement that Guest Moments is GDPR-compliant, and a lawyer has not approved it.",
  footerLabel: "Legal",
  footerLead:
    "A private gallery for the photographs and videos guests share on the day.",
  consent: {
    title: "Cookies",
    body: "Guest Moments uses cookies to sign in, to keep a guest upload with the right event, to remember the language you choose, and to store this choice. It does not use analytics or advertising cookies.",
    accept: "Accept all",
    reject: "Reject non-essential cookies",
    manage: "Manage preferences",
    save: "Save preferences",
    close: "Close",
    necessary: "Strictly necessary",
    necessaryHelp:
      "Sign-in, guest upload identity, language, and this consent choice. These stay on. Without the language cookie, the Greek and English control does not keep your choice.",
    preferences: "Optional cookies",
    preferencesHelp: "There are no optional cookies in this application.",
    unused: "This application does not use analytics or advertising cookies.",
  },
  nav: {
    privacy: "Privacy policy",
    guestPrivacy: "Guest privacy notice",
    terms: "Terms of service",
    cookies: "Cookie policy",
    removal: "Content removal",
    notice: "Legal notice",
    dpa: "Data processing agreement",
    cookieSettings: "Cookie settings",
  },
  cookieColumns: {
    name: "Name",
    category: "Category",
    purpose: "Purpose",
    duration: "Duration",
  },
  cookieCategories: {
    necessary: "Strictly necessary",
    preferences: "Preferences",
  },
  cookieRows: {
    consent: {
      purpose: "Stores the cookie choice and its version.",
      duration: "180 days, or until you change it. This period is an engineering default pending confirmation.",
    },
    session: {
      purpose: "Keeps a couple or administrator signed in. In production the name may start with __Secure-.",
      duration: "7 days. This is the Better Auth default used because the application does not set a different lifetime.",
    },
    guest: {
      purpose:
        "Identifies uploads from this browser for one event, including the only-my-uploads gallery. The value is a random token, not a name.",
      duration: "365 days.",
    },
    locale: {
      purpose: "Remembers the language of the account site after you use the language control.",
      duration: "Until the browser session ends.",
    },
    guestLocale: {
      purpose: "Remembers the language chosen on a guest event page.",
      duration: "365 days.",
    },
  },
  documents: {
    privacy: {
      title: "Privacy policy",
      description: "How Guest Moments handles account, event, and guest information.",
      sections: [
        {
          heading: "Who this notice covers",
          paragraphs: [
            "Guest Moments is a service for a couple to collect wedding photos and videos from guests. Guests do not create accounts. This draft notice describes the processing that the code actually performs.",
            "The legal name, address, registration number, VAT number, and privacy contact email of the operator are not in the application. They are listed as unpublished on the legal notice. Until they are published, this page cannot name the controller.",
          ],
        },
        {
          heading: "Accounts",
          paragraphs: [
            "A couple provides a given name, a surname, an email address, and a password. The application stores the password only as a hash. It also stores whether the email is verified, the preferred language, the role, whether an administrator has activated the account, and the access end date.",
            "A signed-in session stores a session token and its expiry. Better Auth also stores the IP address and user agent for that session. This application does not read those two fields. They are deleted when the session ends, when the person signs out, when the account is disabled, or when the account is deleted. Expired session rows are removed by the daily cleanup.",
            "There is no payment or subscription record in this application.",
          ],
        },
        {
          heading: "Events and guest media",
          paragraphs: [
            "An event stores its name, date, welcome and instruction text, colours, fonts, privacy setting, download setting, and storage quota. The couple may upload a cover image, a logo, and a background image. The couple does not choose a separate retention period for an event.",
            "A guest upload stores the file, its type, size, and original file name, an optional guest name, an optional message, and the random browser token. The application does not ask guests to create an account and does not ask for their age.",
            "Hidden items are not shown to guests. With “full gallery”, anyone with the event link can see the items that are not hidden. With “only my uploads”, a browser sees the items uploaded with its own token. Downloads are available to guests only when the couple leaves downloads on. Preview links expire after 15 minutes. Download links expire after 60 seconds. Upload links expire after 15 minutes.",
          ],
        },
        {
          heading: "Why the information is used",
          paragraphs: [
            "The application uses account data to create the account, sign the person in, send verification and password-reset email when email delivery is configured, and let an administrator activate or disable access.",
            "It uses event and media data to show the guest page, store uploads, let the couple manage the gallery, and remove files when the customer's access ends or someone deletes them.",
            "It uses rate-limit records, which can contain an IP address and an event code, to slow abusive uploads. Those database rows are deleted about 24 hours after the window starts. If Upstash Redis is configured, the same limit is counted there and those keys expire after about 20 minutes.",
            "Security and operational logs store event types, internal ids, and fixed reason codes. They do not store passwords, message text, file names, or email addresses. The current log periods are 30, 90, and 180 days depending on the event type. Those periods are engineering defaults and still need confirmation.",
          ],
        },
        {
          heading: "Legal bases",
          paragraphs: [
            "This draft does not assign a GDPR legal basis to any activity. The operator and a qualified lawyer need to confirm the basis for accounts, guest uploads, photographs of other people, security logs, and the session IP address before this notice is used as a final policy.",
          ],
        },
        {
          heading: "How long information is kept",
          paragraphs: [
            "An administrator sets how long a customer can use the service: 30, 60, 90, 180, or 365 days, or a custom end date. The couple does not choose a retention period for each event. After that access end date, guests cannot open the customer's events, even if the cleanup has not run yet. If the administrator does not extend access before then, the daily cleanup permanently deletes that customer's events, albums, media records, and the photos and videos stored for those events. The customer account remains and stays disabled. Operational, security, and authentication logs keep their own periods, which are separate from this deletion. This application has no archive for restoring a deleted event.",
            "Deleting an event removes that event, its media records, its albums, and its stored files. Deleting one photo or video removes that item. A couple can delete their own account from the account page. An administrator can delete a customer account. Either deletion removes the account, the events, and the stored files from the application database and from object storage.",
            "This deletion does not promise that a database backup, a hosting backup, or an object-storage backup is erased. Those backup periods are not recorded in this repository.",
          ],
        },
        {
          heading: "Who receives information",
          paragraphs: [
            "The couple can open their own events. An administrator can open customer and event records. Guests can open an event when they have its link, within the privacy setting above.",
            "When the related service is configured, the application uses PostgreSQL for the database, Cloudflare R2 for private media storage, Resend for email, Upstash for rate limits, and the site is written to be hosted on Vercel. The repository does not record the production region of any of these. No analytics or advertising service is connected in this code.",
            "The application does not sell personal information.",
          ],
        },
        {
          heading: "International transfers",
          paragraphs: [
            "The production regions are not in this repository, so this draft cannot say whether information stays in the European Economic Area. The operator needs to confirm the regions and, where a transfer needs a safeguard, which safeguard is used.",
          ],
        },
        {
          heading: "Rights and contact",
          paragraphs: [
            "People may have rights of access, rectification, erasure, restriction, objection, and portability, and the right to complain to a supervisory authority. For Cyprus, that authority is the Commissioner for Personal Data Protection. Which rights apply to which activity depends on the legal basis, which is not confirmed in this draft.",
            "A signed-in couple can correct their name, delete media, delete an event, and delete the account. A guest cannot sign in. A person who appears in a photograph, or a couple who cannot sign in, needs the operator’s contact email. That email is not published yet. This draft does not promise a response time.",
          ],
        },
        {
          heading: "Other people and children",
          paragraphs: [
            "Photographs may show guests, including children. The application does not detect faces and does not check ages. The couple decides the event settings and who receives the link. A final policy needs the operator and a lawyer to describe who is responsible for the photographs and on what basis they may be collected.",
          ],
        },
      ],
    },
    guestPrivacy: {
      title: "Guest privacy notice",
      description: "A short notice for people who open an event link or upload photos.",
      sections: [
        {
          heading: "Before you upload",
          paragraphs: [
            "You can open an event and upload photos or videos without an account. Guest Moments stores the file so the couple can keep it. You do not have to enter your name or a message.",
            "The operator’s legal name and contact email are not published in the application yet. Until they are, the couple who invited you is the person you can ask about that wedding’s photographs.",
          ],
        },
        {
          heading: "What is processed",
          paragraphs: [
            "Opening the event can store a random token in a cookie so later uploads from this browser stay with this event. If the couple chose “only my uploads”, that token is also how this browser sees its own photos.",
            "An upload includes the file, its name, type, and size. A name or message is stored only if you type one. The page does not ask for an account, a phone number, or your age.",
          ],
        },
        {
          heading: "Who can see the photos",
          paragraphs: [
            "The couple can see the gallery, including items they have hidden. If the event is a full gallery, anyone with the link can see the items that are not hidden. If it is limited to each guest’s own uploads, another guest’s browser does not receive your files. Downloads follow the switch the couple set. Hidden items are not sent to guests.",
            "The link is the guest’s access to the event. Anyone who has the link can open the page.",
          ],
        },
        {
          heading: "How long it stays",
          paragraphs: [
            "An administrator sets the couple's access duration. The couple does not choose how long each event is kept. After that access ends, guests cannot open the events, and the daily cleanup deletes the files and the events from the application. The couple's account stays disabled rather than being deleted. The couple can also delete items or a whole event sooner. Deleting their account deletes their events and files from the application.",
            "A backup held by the database, hosting, or storage provider may keep a copy. The length of that backup is not set in this application, so this notice cannot say that every copy is already gone.",
          ],
        },
        {
          heading: "Photographs of other people",
          paragraphs: [
            "Please upload photographs you are content for the couple to keep under the event’s settings. Photographs may include other guests and children. This service does not review faces before an upload. If you, or a child you are responsible for, appear in a photograph and you want it reviewed, use the content-removal page. No response time is promised, and the operator email is still unpublished.",
          ],
        },
      ],
    },
    terms: {
      title: "Terms of service",
      description: "The rules for a couple’s Guest Moments account.",
      sections: [
        {
          heading: "The service",
          paragraphs: [
            "Guest Moments lets a couple create wedding events and share a link and a QR code. Guests upload photos and videos without an account. These terms are a draft. They are not a signed contract, and a lawyer has not approved them.",
            "The application has no checkout, subscription, or refund flow. These terms do not add a price or a payment promise.",
          ],
        },
        {
          heading: "Accounts",
          paragraphs: [
            "The account is for the couple. You provide a name, surname, email, and password. An administrator activates service access and can set an end date or disable the account. A disabled account cannot sign in. If access is not extended before that end date, the application's cleanup deletes the account's events and stored media. The account itself remains and stays disabled.",
            "You are responsible for the activity on your account and for keeping the password private. Password reset and email verification are sent only when email delivery is configured.",
          ],
        },
        {
          heading: "Your event",
          paragraphs: [
            "You choose the event text, the privacy setting, and whether guests can download. You decide who receives the link. You are responsible for having a lawful reason to invite uploads and to keep photographs of other people, including children.",
            "You can hide or delete media, delete an event, and delete the account. Those actions remove the corresponding files from the application’s storage. They do not guarantee removal from a provider backup.",
          ],
        },
        {
          heading: "Acceptable use",
          paragraphs: [
            "Do not use the service for unlawful content, for content you have no right to share, or to overload the service. An administrator can disable an account. The application also limits how many uploads a guest can attempt in a short period, and how large a file and an event can be.",
          ],
        },
        {
          heading: "Photographs and video",
          paragraphs: [
            "Uploading a file does not transfer copyright to Guest Moments in this draft. It allows the service to store the file, to show it according to the event settings, and to delete it when you, an administrator, or the retention cleanup does. A lawyer needs to confirm this wording before it is used as a licence.",
          ],
        },
        {
          heading: "Availability and liability",
          paragraphs: [
            "The service can fail, change, or be discontinued. This draft does not limit or accept liability at a stated amount. A lawyer and the operator need to add the clause that should apply, including any consumer-law limits. The governing law and the courts are also pending. The service is intended to be operated from Cyprus, but that is not yet a binding choice of law.",
          ],
        },
      ],
    },
    cookies: {
      title: "Cookie policy",
      description: "The cookies this application actually sets.",
      sections: [
        {
          heading: "What is used",
          paragraphs: [
            "The application sets the cookies in the table below. It does not set analytics, advertising, or social-media cookies. No such tool is loaded, before or after a choice.",
            "Every cookie in the table is strictly necessary for sign-in, guest uploads, the language control, or remembering this choice. Rejecting non-essential cookies leaves this set unchanged, because there is no non-essential cookie to remove.",
            "A hosting provider can add cookies outside this repository. None are defined in this code. The operator needs to confirm the Vercel project settings before any platform cookie is added to this list.",
          ],
        },
        {
          heading: "Your choice",
          paragraphs: [
            "The banner offers Accept all, Reject non-essential cookies, and Manage preferences. Continuing to browse is not treated as a choice. The choice is stored in gm_consent for 180 days, which is an engineering default pending confirmation. A newer consent version asks again. It does not silently widen an older choice.",
            "You can reopen the panel from Cookie settings in the footer, on a guest page, or on this page.",
          ],
        },
      ],
    },
    removal: {
      title: "Content removal",
      description: "How to ask for a photograph or video to be reviewed.",
      sections: [
        {
          heading: "Who can ask",
          paragraphs: [
            "A couple can hide or delete media in the event gallery, delete an event, or delete the account. A guest cannot delete another person’s upload from the guest page.",
            "A person who appears in a photograph or video, including a parent or guardian asking about a child, can ask for a review. So can someone who cannot sign in.",
          ],
        },
        {
          heading: "How a request is handled",
          paragraphs: [
            "The application does not yet have a published privacy email or an intake form, because the operator’s contact address has not been provided. This page cannot send a request into a mailbox that does not exist.",
            "When a contact email is published, a request should include a way to reply, the event link or code if you have it, and a description of the item. Do not send more personal information than is needed to find it.",
            "This draft does not promise a response time or a particular outcome. Hiding an item stops guests from seeing it. Deleting it removes it from the application database and from object storage. A provider backup may still contain a copy for a period that has not been set.",
          ],
        },
      ],
    },
    notice: {
      title: "Legal notice",
      description: "Operator details that still have to be supplied.",
      sections: [
        {
          heading: "Service name",
          paragraphs: [
            "The service name used in the application is Guest Moments. The header reads “Guest Moments”.",
          ],
        },
        {
          heading: "Details not yet published",
          paragraphs: [
            "The following are not in the repository and must not be invented: the legal name of the operator; the registered office address; the company registration number, if a company is registered; the VAT number, if one exists; and the email address for privacy and content-removal requests.",
            "Until those values are supplied and checked, this page is only a placeholder. It is not a completed legal imprint.",
          ],
        },
      ],
    },
    dpa: {
      title: "Data processing agreement",
      description: "A draft agreement for legal review. It is not in force.",
      sections: [
        {
          heading: "Status",
          paragraphs: [
            "This is a draft for review. It is not a binding agreement. The application does not record acceptance of it. A qualified lawyer needs to revise it before anyone relies on it.",
            "Do not treat the couple as the controller for every activity, and do not treat Guest Moments as the processor for every activity. Accounts, security logs, and operation of the platform are the operator’s own processing and are described in the privacy policy. Hosting of event media, on the couple’s instructions and settings, is the activity that may be processing on behalf of the couple. The final split of roles is a legal decision and is not made by this draft.",
          ],
        },
        {
          heading: "Instructions",
          paragraphs: [
            "For the hosting activity, the couple’s instructions are the actions the product provides: create and edit the event, choose the privacy and download settings, invite guests with the link, hide or delete media, delete the event, and delete the account. The operator must not use those files for advertising. This application does not.",
          ],
        },
        {
          heading: "Confidentiality and security",
          paragraphs: [
            "People who operate the service should access customer data only when they need to. The measures in the application today include signed-in access for couples, separate owner access, private object storage, short-lived media links, httpOnly guest tokens, password rules, session revocation on password reset, rate limits, and logs that omit message text and email addresses. These are descriptions of the code, not a certification.",
          ],
        },
        {
          heading: "Subprocessors",
          paragraphs: [
            "When configured, the application uses PostgreSQL, Cloudflare R2, Resend, Upstash, and is written for hosting on Vercel. A processor agreement needs the operator to confirm which of these are actually used in production, in which region, and on which contract. Development can store files on the application server instead of R2. No other subprocessor is connected in this code.",
          ],
        },
        {
          heading: "Requests, incidents, and deletion",
          paragraphs: [
            "The operator will need a process to help with requests from people in photographs and from couples. That contact email is not published yet, and this draft sets no response time.",
            "This draft does not promise to notify the couple within a stated number of hours after an incident. The notification duty, and who notifies a supervisory authority, must be added by a lawyer.",
            "Deletion of an event or account removes the related rows and object-storage files as described in the privacy policy. If an administrator does not extend a customer's access before it ends, the same cleanup deletes that customer's events and stored media and leaves the account disabled. Backups held by infrastructure or providers are outside that deletion, so the application cannot guarantee that every copy is erased at once. On termination, the same deletion path is what the application can do today. Return of a full export is not implemented.",
          ],
        },
        {
          heading: "Audit",
          paragraphs: [
            "This draft does not grant a specific audit right, a specific frequency, or a specific cost. The operator and a lawyer should add that clause if a customer needs it. There is no log viewer in the product.",
          ],
        },
      ],
    },
  },
} satisfies PrivacyCopy;

const el: PrivacyCopy = {
  draft:
    "Προσχέδιο για τον υπεύθυνο λειτουργίας και για νομικό έλεγχο. Περιγράφει την εφαρμογή όπως λειτουργεί σήμερα. Δεν αποτελεί δήλωση ότι το Guest Moments είναι συμβατό με τον GDPR και δεν έχει εγκριθεί από δικηγόρο.",
  footerLabel: "Νομικά",
  footerLead:
    "Μια ιδιωτική συλλογή για τις φωτογραφίες και τα βίντεο που μοιράζονται οι καλεσμένοι την ημέρα της εκδήλωσης.",
  consent: {
    title: "Cookies",
    body: "Το Guest Moments χρησιμοποιεί cookies για τη σύνδεση, για να μείνει το ανέβασμα ενός καλεσμένου στη σωστή εκδήλωση, για να θυμάται τη γλώσσα που επιλέγετε, και για να αποθηκεύει αυτή την επιλογή. Δεν χρησιμοποιεί cookies ανάλυσης ή διαφήμισης.",
    accept: "Αποδοχή όλων",
    reject: "Απόρριψη μη απαραίτητων",
    manage: "Διαχείριση προτιμήσεων",
    save: "Αποθήκευση προτιμήσεων",
    close: "Κλείσιμο",
    necessary: "Απολύτως απαραίτητα",
    necessaryHelp:
      "Σύνδεση, ταυτότητα ανεβάσματος καλεσμένου, γλώσσα και αυτή η επιλογή συγκατάθεσης. Μένουν ενεργά. Χωρίς το cookie γλώσσας, η επιλογή ελληνικών ή αγγλικών δεν διατηρείται.",
    preferences: "Προαιρετικά cookies",
    preferencesHelp: "Δεν υπάρχουν προαιρετικά cookies σε αυτή την εφαρμογή.",
    unused: "Η εφαρμογή δεν χρησιμοποιεί cookies ανάλυσης ή διαφήμισης.",
  },
  nav: {
    privacy: "Πολιτική απορρήτου",
    guestPrivacy: "Ενημέρωση για καλεσμένους",
    terms: "Όροι χρήσης",
    cookies: "Πολιτική cookies",
    removal: "Αφαίρεση περιεχομένου",
    notice: "Νομική σημείωση",
    dpa: "Συμφωνία επεξεργασίας",
    cookieSettings: "Ρυθμίσεις cookies",
  },
  cookieColumns: {
    name: "Όνομα",
    category: "Κατηγορία",
    purpose: "Σκοπός",
    duration: "Διάρκεια",
  },
  cookieCategories: {
    necessary: "Απολύτως απαραίτητα",
    preferences: "Προτιμήσεις",
  },
  cookieRows: {
    consent: {
      purpose: "Αποθηκεύει την επιλογή για τα cookies και την έκδοσή της.",
      duration: "180 ημέρες, ή μέχρι να την αλλάξετε. Η περίοδος είναι τεχνική προεπιλογή και εκκρεμεί επιβεβαίωση.",
    },
    session: {
      purpose: "Κρατά συνδεδεμένο το ζευγάρι ή τον διαχειριστή. Στην παραγωγή το όνομα μπορεί να αρχίζει με __Secure-.",
      duration: "7 ημέρες. Είναι η προεπιλογή του Better Auth, γιατί η εφαρμογή δεν ορίζει άλλη διάρκεια.",
    },
    guest: {
      purpose:
        "Συνδέει τα ανεβάσματα αυτού του browser με μία εκδήλωση, και στη ρύθμιση «μόνο τα δικά μου» δείχνει μόνο εκείνα. Η τιμή είναι τυχαίο αναγνωριστικό, όχι όνομα.",
      duration: "365 ημέρες.",
    },
    locale: {
      purpose: "Θυμάται τη γλώσσα του site του λογαριασμού αφού χρησιμοποιήσετε τον διακόπτη γλώσσας.",
      duration: "Μέχρι να κλείσει η συνεδρία του browser.",
    },
    guestLocale: {
      purpose: "Θυμάται τη γλώσσα που επιλέξατε σε σελίδα καλεσμένων.",
      duration: "365 ημέρες.",
    },
  },
  documents: {
    privacy: {
      title: "Πολιτική απορρήτου",
      description: "Πώς το Guest Moments χειρίζεται στοιχεία λογαριασμού, εκδήλωσης και καλεσμένων.",
      sections: [
        {
          heading: "Ποιους αφορά",
          paragraphs: [
            "Το Guest Moments είναι υπηρεσία για να συγκεντρώνει ένα ζευγάρι φωτογραφίες και βίντεο γάμου από τους καλεσμένους. Οι καλεσμένοι δεν δημιουργούν λογαριασμό. Αυτό το προσχέδιο περιγράφει την επεξεργασία που κάνει πράγματι ο κώδικας.",
            "Η επωνυμία, η διεύθυνση, ο αριθμός μητρώου, ο ΑΦΜ και το email επικοινωνίας για το απόρρητο δεν υπάρχουν στην εφαρμογή. Αναφέρονται ως αδημοσίευτα στη νομική σημείωση. Μέχρι να δημοσιευτούν, η σελίδα δεν μπορεί να κατονομάσει τον υπεύθυνο επεξεργασίας.",
          ],
        },
        {
          heading: "Λογαριασμοί",
          paragraphs: [
            "Το ζευγάρι δίνει όνομα, επώνυμο, email και κωδικό. Η εφαρμογή αποθηκεύει τον κωδικό μόνο ως σύνοψη. Αποθηκεύει επίσης αν το email επιβεβαιώθηκε, τη γλώσσα, τον ρόλο, αν ο διαχειριστής ενεργοποίησε τον λογαριασμό και την ημερομηνία λήξης της πρόσβασης.",
            "Η σύνδεση αποθηκεύει αναγνωριστικό συνεδρίας και τη λήξη του. Το Better Auth αποθηκεύει επίσης τη διεύθυνση IP και τον user agent της συνεδρίας. Η εφαρμογή δεν διαβάζει αυτά τα δύο πεδία. Σβήνουν όταν λήγει η συνεδρία, στην αποσύνδεση, όταν απενεργοποιείται ο λογαριασμός ή όταν διαγράφεται. Οι ληγμένες συνεδρίες αφαιρούνται από τον ημερήσιο καθαρισμό.",
            "Δεν υπάρχει εγγραφή πληρωμής ή συνδρομής σε αυτή την εφαρμογή.",
          ],
        },
        {
          heading: "Εκδηλώσεις και αρχεία καλεσμένων",
          paragraphs: [
            "Η εκδήλωση αποθηκεύει όνομα, ημερομηνία, κείμενα, χρώματα, γραμματοσειρές, ρύθμιση απορρήτου, ρύθμιση λήψης και όριο χώρου. Το ζευγάρι μπορεί να ανεβάσει εξώφυλλο, λογότυπο και φόντο. Το ζευγάρι δεν επιλέγει ξεχωριστή διάρκεια φύλαξης για μια εκδήλωση.",
            "Το ανέβασμα καλεσμένου αποθηκεύει το αρχείο, τον τύπο, το μέγεθος και το αρχικό όνομα αρχείου, προαιρετικό όνομα, προαιρετικό μήνυμα και το τυχαίο αναγνωριστικό του browser. Η εφαρμογή δεν ζητά λογαριασμό ούτε ηλικία.",
            "Τα κρυμμένα στοιχεία δεν εμφανίζονται στους καλεσμένους. Με «πλήρη συλλογή», όποιος έχει τον σύνδεσμο βλέπει όσα δεν είναι κρυμμένα. Με «μόνο τα δικά μου», ένας browser βλέπει τα αρχεία του δικού του αναγνωριστικού. Η λήψη προσφέρεται μόνο αν το ζευγάρι την αφήσει ανοιχτή. Οι σύνδεσμοι προεπισκόπησης λήγουν σε 15 λεπτά. Οι σύνδεσμοι λήψης λήγουν σε 60 δευτερόλεπτα. Οι σύνδεσμοι ανεβάσματος λήγουν σε 15 λεπτά.",
          ],
        },
        {
          heading: "Γιατί χρησιμοποιούνται",
          paragraphs: [
            "Τα στοιχεία λογαριασμού χρησιμοποιούνται για τη δημιουργία λογαριασμού, τη σύνδεση, την αποστολή email επιβεβαίωσης και επαναφοράς κωδικού όταν η αποστολή είναι ρυθμισμένη, και για να ενεργοποιεί ή να απενεργοποιεί την πρόσβαση ο διαχειριστής.",
            "Τα στοιχεία εκδήλωσης και τα αρχεία χρησιμοποιούνται για τη σελίδα καλεσμένων, την αποθήκευση, τη διαχείριση της συλλογής και τη διαγραφή όταν λήγει η πρόσβαση του πελάτη ή όταν κάποιος τα διαγράφει.",
            "Οι εγγραφές ορίου ρυθμού, που μπορεί να περιέχουν διεύθυνση IP και κωδικό εκδήλωσης, επιβραδύνουν καταχρηστικά ανεβάσματα. Οι γραμμές αυτές σβήνουν περίπου 24 ώρες μετά την έναρξη του παραθύρου. Αν έχει ρυθμιστεί Upstash Redis, το ίδιο όριο μετράται εκεί και τα κλειδιά λήγουν σε περίπου 20 λεπτά.",
            "Τα αρχεία καταγραφής ασφαλείας και λειτουργίας κρατούν τύπους συμβάντων, εσωτερικά αναγνωριστικά και σταθερούς κωδικούς αιτίας. Δεν κρατούν κωδικούς πρόσβασης, κείμενο μηνύματος, ονόματα αρχείων ή email. Οι τρέχουσες περίοδοι είναι 30, 90 και 180 ημέρες ανάλογα με τον τύπο. Είναι τεχνικές προεπιλογές και χρειάζονται επιβεβαίωση.",
          ],
        },
        {
          heading: "Νομικές βάσεις",
          paragraphs: [
            "Αυτό το προσχέδιο δεν αποδίδει νομική βάση του GDPR σε καμία δραστηριότητα. Ο υπεύθυνος λειτουργίας και ένας δικηγόρος πρέπει να επιβεβαιώσουν τη βάση για τους λογαριασμούς, τα ανεβάσματα, τις φωτογραφίες άλλων προσώπων, τα αρχεία καταγραφής και τη διεύθυνση IP της συνεδρίας, πριν η σελίδα χρησιμοποιηθεί ως τελική πολιτική.",
          ],
        },
        {
          heading: "Διάρκεια",
          paragraphs: [
            "Ο διαχειριστής ορίζει πόσο μπορεί να χρησιμοποιεί την υπηρεσία ένας πελάτης: 30, 60, 90, 180 ή 365 ημέρες, ή μια προσαρμοσμένη ημερομηνία λήξης. Το ζευγάρι δεν επιλέγει διάρκεια φύλαξης για κάθε εκδήλωση. Μετά από εκείνη την ημερομηνία οι καλεσμένοι δεν ανοίγουν τις εκδηλώσεις του πελάτη, ακόμη και αν ο καθαρισμός δεν έχει τρέξει. Αν ο διαχειριστής δεν παρατείνει την πρόσβαση πριν από τότε, ο ημερήσιος καθαρισμός διαγράφει οριστικά τις εκδηλώσεις του πελάτη, τα άλμπουμ, τις εγγραφές μέσων και τις φωτογραφίες και τα βίντεο αυτών των εκδηλώσεων. Ο λογαριασμός του πελάτη παραμένει και μένει απενεργοποιημένος. Τα αρχεία λειτουργίας, ασφάλειας και ταυτοποίησης έχουν δικές τους περιόδους, χωριστά από αυτή τη διαγραφή. Η εφαρμογή δεν έχει αρχείο για επαναφορά μιας διαγραμμένης εκδήλωσης.",
            "Η διαγραφή εκδήλωσης αφαιρεί την εκδήλωση, τα μέσα, τα άλμπουμ και τα αρχεία. Η διαγραφή μιας φωτογραφίας ή ενός βίντεο αφαιρεί αυτό το στοιχείο. Το ζευγάρι μπορεί να διαγράψει τον λογαριασμό του από τη σελίδα λογαριασμού. Ο διαχειριστής μπορεί να διαγράψει λογαριασμό πελάτη. Και οι δύο διαγραφές αφαιρούν τον λογαριασμό, τις εκδηλώσεις και τα αρχεία από τη βάση και από τον αποθηκευτικό χώρο αντικειμένων.",
            "Η διαγραφή αυτή δεν υπόσχεται ότι σβήνεται και ένα αντίγραφο ασφαλείας της βάσης, της φιλοξενίας ή του αποθηκευτικού χώρου. Οι διάρκειες αυτών των αντιγράφων δεν είναι γραμμένες στο αποθετήριο.",
          ],
        },
        {
          heading: "Ποιοι λαμβάνουν στοιχεία",
          paragraphs: [
            "Το ζευγάρι ανοίγει τις δικές του εκδηλώσεις. Ο διαχειριστής ανοίγει λογαριασμούς και εκδηλώσεις. Οι καλεσμένοι ανοίγουν μια εκδήλωση όταν έχουν τον σύνδεσμο, μέσα στη ρύθμιση απορρήτου.",
            "Όταν η σχετική υπηρεσία είναι ρυθμισμένη, η εφαρμογή χρησιμοποιεί PostgreSQL για τη βάση, Cloudflare R2 για ιδιωτική αποθήκευση μέσων, Resend για email, Upstash για όρια ρυθμού, και είναι γραμμένη για φιλοξενία στη Vercel. Το αποθετήριο δεν καταγράφει την περιοχή παραγωγής κανενός από αυτά. Δεν συνδέεται υπηρεσία ανάλυσης ή διαφήμισης.",
            "Η εφαρμογή δεν πουλά προσωπικά στοιχεία.",
          ],
        },
        {
          heading: "Διαβιβάσεις εκτός ΕΟΧ",
          paragraphs: [
            "Οι περιοχές παραγωγής δεν είναι στο αποθετήριο, άρα το προσχέδιο δεν μπορεί να πει αν τα στοιχεία μένουν στον Ευρωπαϊκό Οικονομικό Χώρο. Ο υπεύθυνος λειτουργίας πρέπει να επιβεβαιώσει τις περιοχές και, όπου χρειάζεται εγγύηση διαβίβασης, ποια εγγύηση χρησιμοποιείται.",
          ],
        },
        {
          heading: "Δικαιώματα και επικοινωνία",
          paragraphs: [
            "Οι άνθρωποι μπορεί να έχουν δικαιώματα πρόσβασης, διόρθωσης, διαγραφής, περιορισμού, εναντίωσης και φορητότητας, και δικαίωμα καταγγελίας σε εποπτική αρχή. Για την Κύπρο, η αρχή είναι η Επίτροπος Προστασίας Δεδομένων Προσωπικού Χαρακτήρα. Ποια δικαιώματα ισχύουν εξαρτάται από τη νομική βάση, που δεν έχει επιβεβαιωθεί σε αυτό το προσχέδιο.",
            "Το συνδεδεμένο ζευγάρι μπορεί να διορθώσει το όνομά του, να διαγράψει μέσα, να διαγράψει εκδήλωση και να διαγράψει τον λογαριασμό. Ο καλεσμένος δεν συνδέεται. Όποιος εμφανίζεται σε φωτογραφία, ή όποιο ζευγάρι δεν μπορεί να συνδεθεί, χρειάζεται το email του υπευθύνου λειτουργίας. Το email δεν έχει δημοσιευτεί. Το προσχέδιο δεν υπόσχεται χρόνο απάντησης.",
          ],
        },
        {
          heading: "Άλλα πρόσωπα και παιδιά",
          paragraphs: [
            "Οι φωτογραφίες μπορεί να δείχνουν καλεσμένους, και παιδιά. Η εφαρμογή δεν εντοπίζει πρόσωπα και δεν ελέγχει ηλικίες. Το ζευγάρι ορίζει τις ρυθμίσεις και ποιος λαμβάνει τον σύνδεσμο. Η τελική πολιτική χρειάζεται τον υπεύθυνο λειτουργίας και έναν δικηγόρο για να περιγράψουν ποιος είναι υπεύθυνος για τις φωτογραφίες και με ποια βάση συλλέγονται.",
          ],
        },
      ],
    },
    guestPrivacy: {
      title: "Ενημέρωση απορρήτου για καλεσμένους",
      description: "Σύντομη ενημέρωση για όποιον ανοίγει έναν σύνδεσμο εκδήλωσης ή ανεβάζει φωτογραφίες.",
      sections: [
        {
          heading: "Πριν ανεβάσετε",
          paragraphs: [
            "Μπορείτε να ανοίξετε μια εκδήλωση και να ανεβάσετε φωτογραφίες ή βίντεο χωρίς λογαριασμό. Το Guest Moments αποθηκεύει το αρχείο για να το κρατήσει το ζευγάρι. Δεν είναι υποχρεωτικό να γράψετε όνομα ή μήνυμα.",
            "Η επωνυμία και το email του υπευθύνου λειτουργίας δεν έχουν δημοσιευτεί ακόμη στην εφαρμογή. Μέχρι τότε, το ζευγάρι που σας κάλεσε είναι το πρόσωπο που μπορείτε να ρωτήσετε για τις φωτογραφίες αυτού του γάμου.",
          ],
        },
        {
          heading: "Τι επεξεργάζεται",
          paragraphs: [
            "Το άνοιγμα της εκδήλωσης μπορεί να αποθηκεύσει ένα τυχαίο αναγνωριστικό σε cookie, ώστε τα επόμενα ανεβάσματα από αυτόν τον browser να μείνουν σε αυτή την εκδήλωση. Αν το ζευγάρι επέλεξε «μόνο τα δικά μου», το ίδιο αναγνωριστικό ορίζει ποιες φωτογραφίες βλέπει αυτός ο browser.",
            "Το ανέβασμα περιλαμβάνει το αρχείο, το όνομά του, τον τύπο και το μέγεθος. Όνομα ή μήνυμα αποθηκεύεται μόνο αν το γράψετε. Η σελίδα δεν ζητά λογαριασμό, τηλέφωνο ή ηλικία.",
          ],
        },
        {
          heading: "Ποιοι βλέπουν τις φωτογραφίες",
          paragraphs: [
            "Το ζευγάρι βλέπει τη συλλογή, μαζί με όσα έχει κρύψει. Αν η εκδήλωση είναι πλήρης συλλογή, όποιος έχει τον σύνδεσμο βλέπει όσα δεν είναι κρυμμένα. Αν περιορίζεται στα ανεβάσματα του κάθε καλεσμένου, ο browser άλλου καλεσμένου δεν λαμβάνει τα δικά σας αρχεία. Η λήψη ακολουθεί τον διακόπτη του ζευγαριού. Τα κρυμμένα στοιχεία δεν στέλνονται σε καλεσμένους.",
            "Ο σύνδεσμος είναι η πρόσβαση του καλεσμένου στην εκδήλωση. Όποιος έχει τον σύνδεσμο μπορεί να ανοίξει τη σελίδα.",
          ],
        },
        {
          heading: "Πόσο μένουν",
          paragraphs: [
            "Ο διαχειριστής ορίζει τη διάρκεια πρόσβασης του ζευγαριού. Το ζευγάρι δεν επιλέγει πόσο κρατιέται κάθε εκδήλωση. Μετά τη λήξη της πρόσβασης οι καλεσμένοι δεν ανοίγουν τις εκδηλώσεις, και ο ημερήσιος καθαρισμός διαγράφει τα αρχεία και τις εκδηλώσεις από την εφαρμογή. Ο λογαριασμός του ζευγαριού μένει απενεργοποιημένος και δεν διαγράφεται. Το ζευγάρι μπορεί επίσης να διαγράψει στοιχεία ή ολόκληρη την εκδήλωση νωρίτερα. Η διαγραφή του λογαριασμού του διαγράφει τις εκδηλώσεις και τα αρχεία από την εφαρμογή.",
            "Ένα αντίγραφο ασφαλείας της βάσης, της φιλοξενίας ή του αποθηκευτικού χώρου μπορεί να κρατά αντίγραφο. Η διάρκεια αυτού του αντιγράφου δεν ορίζεται στην εφαρμογή, άρα αυτή η ενημέρωση δεν μπορεί να πει ότι κάθε αντίγραφο έχει ήδη σβηστεί.",
          ],
        },
        {
          heading: "Φωτογραφίες άλλων προσώπων",
          paragraphs: [
            "Ανεβάστε φωτογραφίες που δέχεστε να κρατήσει το ζευγάρι με τις ρυθμίσεις της εκδήλωσης. Οι φωτογραφίες μπορεί να περιλαμβάνουν άλλους καλεσμένους και παιδιά. Η υπηρεσία δεν ελέγχει πρόσωπα πριν από το ανέβασμα. Αν εσείς, ή ένα παιδί για το οποίο είστε υπεύθυνοι, εμφανίζεστε σε φωτογραφία και θέλετε έλεγχο, χρησιμοποιήστε τη σελίδα αφαίρεσης περιεχομένου. Δεν υπόσχεται χρόνος απάντησης, και το email του υπευθύνου λειτουργίας δεν έχει δημοσιευτεί.",
          ],
        },
      ],
    },
    terms: {
      title: "Όροι χρήσης",
      description: "Οι κανόνες για τον λογαριασμό ενός ζευγαριού στο Guest Moments.",
      sections: [
        {
          heading: "Η υπηρεσία",
          paragraphs: [
            "Το Guest Moments επιτρέπει σε ένα ζευγάρι να δημιουργεί εκδηλώσεις γάμου και να μοιράζεται σύνδεσμο και κωδικό QR. Οι καλεσμένοι ανεβάζουν φωτογραφίες και βίντεο χωρίς λογαριασμό. Οι όροι είναι προσχέδιο. Δεν είναι υπογεγραμμένη σύμβαση και δεν έχουν εγκριθεί από δικηγόρο.",
            "Η εφαρμογή δεν έχει ταμείο, συνδρομή ή ροή επιστροφής χρημάτων. Οι όροι δεν προσθέτουν τιμή ή υπόσχεση πληρωμής.",
          ],
        },
        {
          heading: "Λογαριασμοί",
          paragraphs: [
            "Ο λογαριασμός είναι για το ζευγάρι. Δίνετε όνομα, επώνυμο, email και κωδικό. Ο διαχειριστής ενεργοποιεί την πρόσβαση και μπορεί να ορίσει ημερομηνία λήξης ή να απενεργοποιήσει τον λογαριασμό. Ο απενεργοποιημένος λογαριασμός δεν συνδέεται. Αν η πρόσβαση δεν παραταθεί πριν από εκείνη την ημερομηνία, ο καθαρισμός της εφαρμογής διαγράφει τις εκδηλώσεις και τα αποθηκευμένα αρχεία του λογαριασμού. Ο ίδιος ο λογαριασμός παραμένει και μένει απενεργοποιημένος.",
            "Είστε υπεύθυνοι για τη δραστηριότητα του λογαριασμού και για να μείνει ο κωδικός ιδιωτικός. Η επαναφορά κωδικού και η επιβεβαίωση email στέλνονται μόνο όταν η αποστολή email είναι ρυθμισμένη.",
          ],
        },
        {
          heading: "Η εκδήλωσή σας",
          paragraphs: [
            "Εσείς επιλέγετε τα κείμενα, τη ρύθμιση απορρήτου και αν οι καλεσμένοι μπορούν να κατεβάσουν. Εσείς αποφασίζετε ποιος λαμβάνει τον σύνδεσμο. Είστε υπεύθυνοι να έχετε νόμιμο λόγο για να προσκαλέσετε ανεβάσματα και να κρατήσετε φωτογραφίες άλλων προσώπων, συμπεριλαμβανομένων παιδιών.",
            "Μπορείτε να κρύψετε ή να διαγράψετε μέσα, να διαγράψετε εκδήλωση και να διαγράψετε τον λογαριασμό. Αυτές οι ενέργειες αφαιρούν τα αντίστοιχα αρχεία από τον αποθηκευτικό χώρο της εφαρμογής. Δεν εγγυώνται αφαίρεση από αντίγραφο ασφαλείας παρόχου.",
          ],
        },
        {
          heading: "Αποδεκτή χρήση",
          paragraphs: [
            "Μην χρησιμοποιείτε την υπηρεσία για παράνομο περιεχόμενο, για περιεχόμενο που δεν έχετε δικαίωμα να μοιραστείτε, ή για να την υπερφορτώσετε. Ο διαχειριστής μπορεί να απενεργοποιήσει λογαριασμό. Η εφαρμογή περιορίζει επίσης πόσα ανεβάσματα μπορεί να επιχειρήσει ένας καλεσμένος σε σύντομο διάστημα, και πόσο μεγάλο μπορεί να είναι ένα αρχείο και μια εκδήλωση.",
          ],
        },
        {
          heading: "Φωτογραφίες και βίντεο",
          paragraphs: [
            "Το ανέβασμα δεν μεταβιβάζει πνευματική ιδιοκτησία στο Guest Moments σε αυτό το προσχέδιο. Επιτρέπει στην υπηρεσία να αποθηκεύσει το αρχείο, να το δείξει σύμφωνα με τις ρυθμίσεις της εκδήλωσης και να το διαγράψει όταν το κάνετε εσείς, ο διαχειριστής ή ο καθαρισμός διατήρησης. Ένας δικηγόρος πρέπει να επιβεβαιώσει τη διατύπωση πριν χρησιμοποιηθεί ως άδεια.",
          ],
        },
        {
          heading: "Διαθεσιμότητα και ευθύνη",
          paragraphs: [
            "Η υπηρεσία μπορεί να αποτύχει, να αλλάξει ή να σταματήσει. Το προσχέδιο δεν περιορίζει ούτε αναλαμβάνει ευθύνη σε συγκεκριμένο ποσό. Ένας δικηγόρος και ο υπεύθυνος λειτουργίας πρέπει να προσθέσουν τη ρήτρα που πρέπει να ισχύσει, μαζί με όρια του δικαίου του καταναλωτή. Το εφαρμοστέο δίκαιο και τα δικαστήρια εκκρεμούν επίσης. Η υπηρεσία προορίζεται να λειτουργεί από την Κύπρο, αλλά αυτό δεν είναι ακόμη δεσμευτική επιλογή δικαίου.",
          ],
        },
      ],
    },
    cookies: {
      title: "Πολιτική cookies",
      description: "Τα cookies που ορίζει πράγματι αυτή η εφαρμογή.",
      sections: [
        {
          heading: "Τι χρησιμοποιείται",
          paragraphs: [
            "Η εφαρμογή ορίζει τα cookies του πίνακα. Δεν ορίζει cookies ανάλυσης, διαφήμισης ή κοινωνικών δικτύων. Κανένα τέτοιο εργαλείο δεν φορτώνει, ούτε πριν ούτε μετά από μια επιλογή.",
            "Κάθε cookie του πίνακα είναι απολύτως απαραίτητο για τη σύνδεση, τα ανεβάσματα καλεσμένων, τον διακόπτη γλώσσας ή για να θυμάται αυτή την επιλογή. Η απόρριψη των μη απαραίτητων δεν αφαιρεί κανένα, γιατί δεν υπάρχει μη απαραίτητο cookie.",
            "Ένας πάροχος φιλοξενίας μπορεί να προσθέσει cookies έξω από αυτό το αποθετήριο. Κανένα δεν ορίζεται σε αυτόν τον κώδικα. Ο υπεύθυνος λειτουργίας πρέπει να επιβεβαιώσει τις ρυθμίσεις του project στη Vercel πριν προστεθεί στον κατάλογο cookie πλατφόρμας.",
          ],
        },
        {
          heading: "Η επιλογή σας",
          paragraphs: [
            "Το πλαίσιο προσφέρει Αποδοχή όλων, Απόρριψη μη απαραίτητων και Διαχείριση προτιμήσεων. Η συνέχιση της περιήγησης δεν μετρά ως επιλογή. Η επιλογή αποθηκεύεται στο gm_consent για 180 ημέρες, που είναι τεχνική προεπιλογή και εκκρεμεί επιβεβαίωση. Νεότερη έκδοση συγκατάθεσης ξαναρωτά. Δεν διευρύνει σιωπηλά μια παλαιότερη επιλογή.",
            "Μπορείτε να ξανανοίξετε τον πίνακα από τις Ρυθμίσεις cookies στο υποσέλιδο, σε σελίδα καλεσμένου ή σε αυτή τη σελίδα.",
          ],
        },
      ],
    },
    removal: {
      title: "Αφαίρεση περιεχομένου",
      description: "Πώς να ζητήσετε έλεγχο μιας φωτογραφίας ή ενός βίντεο.",
      sections: [
        {
          heading: "Ποιος μπορεί να ζητήσει",
          paragraphs: [
            "Το ζευγάρι μπορεί να κρύψει ή να διαγράψει μέσα στη συλλογή, να διαγράψει εκδήλωση ή να διαγράψει τον λογαριασμό. Ένας καλεσμένος δεν μπορεί να διαγράψει το ανέβασμα άλλου από τη σελίδα καλεσμένων.",
            "Όποιος εμφανίζεται σε φωτογραφία ή βίντεο, και γονέας ή κηδεμόνας που ρωτά για παιδί, μπορεί να ζητήσει έλεγχο. Το ίδιο και όποιος δεν μπορεί να συνδεθεί.",
          ],
        },
        {
          heading: "Πώς χειρίζεται ένα αίτημα",
          paragraphs: [
            "Η εφαρμογή δεν έχει ακόμη δημοσιευμένο email απορρήτου ούτε φόρμα υποδοχής, γιατί δεν έχει δοθεί διεύθυνση επικοινωνίας. Η σελίδα δεν μπορεί να στείλει αίτημα σε γραμματοκιβώτιο που δεν υπάρχει.",
            "Όταν δημοσιευτεί email, ένα αίτημα πρέπει να περιλαμβάνει τρόπο απάντησης, τον σύνδεσμο ή τον κωδικό της εκδήλωσης αν τον έχετε, και περιγραφή του στοιχείου. Μην στέλνετε περισσότερα προσωπικά στοιχεία από όσα χρειάζονται για να βρεθεί.",
            "Το προσχέδιο δεν υπόσχεται χρόνο απάντησης ούτε συγκεκριμένο αποτέλεσμα. Η απόκρυψη σταματά την εμφάνιση στους καλεσμένους. Η διαγραφή το αφαιρεί από τη βάση και από τον αποθηκευτικό χώρο αντικειμένων. Ένα αντίγραφο ασφαλείας παρόχου μπορεί ακόμη να περιέχει αντίγραφο για διάστημα που δεν έχει οριστεί.",
          ],
        },
      ],
    },
    notice: {
      title: "Νομική σημείωση",
      description: "Στοιχεία υπευθύνου λειτουργίας που πρέπει ακόμη να δοθούν.",
      sections: [
        {
          heading: "Όνομα υπηρεσίας",
          paragraphs: [
            "Το όνομα της υπηρεσίας στην εφαρμογή είναι Guest Moments. Η κεφαλίδα γράφει «Guest Moments».",
          ],
        },
        {
          heading: "Στοιχεία που δεν έχουν δημοσιευτεί",
          paragraphs: [
            "Τα παρακάτω δεν είναι στο αποθετήριο και δεν πρέπει να επινοηθούν: η επωνυμία του υπευθύνου λειτουργίας, η έδρα, ο αριθμός μητρώου εταιρείας αν υπάρχει εταιρεία, ο ΑΦΜ αν υπάρχει, και το email για αιτήματα απορρήτου και αφαίρεσης περιεχομένου.",
            "Μέχρι να δοθούν και να ελεγχθούν αυτές οι τιμές, η σελίδα είναι μόνο θέση αναμονής. Δεν είναι ολοκληρωμένο νομικό αποτύπωμα.",
          ],
        },
      ],
    },
    dpa: {
      title: "Συμφωνία επεξεργασίας δεδομένων",
      description: "Προσχέδιο συμφωνίας για νομικό έλεγχο. Δεν ισχύει.",
      sections: [
        {
          heading: "Κατάσταση",
          paragraphs: [
            "Αυτό είναι προσχέδιο για έλεγχο. Δεν είναι δεσμευτική συμφωνία. Η εφαρμογή δεν καταγράφει αποδοχή της. Ένας δικηγόρος πρέπει να τη διορθώσει πριν βασιστεί κάποιος σε αυτή.",
            "Μην θεωρείτε το ζευγάρι υπεύθυνο επεξεργασίας για κάθε δραστηριότητα, ούτε το Guest Moments εκτελούντα την επεξεργασία για κάθε δραστηριότητα. Οι λογαριασμοί, τα αρχεία καταγραφής και η λειτουργία της πλατφόρμας είναι ίδια επεξεργασία του υπευθύνου λειτουργίας και περιγράφονται στην πολιτική απορρήτου. Η φιλοξενία των μέσων της εκδήλωσης, με τις οδηγίες και τις ρυθμίσεις του ζευγαριού, είναι η δραστηριότητα που μπορεί να είναι επεξεργασία για λογαριασμό του ζευγαριού. Ο τελικός διαχωρισμός ρόλων είναι νομική απόφαση και δεν τον κάνει αυτό το προσχέδιο.",
          ],
        },
        {
          heading: "Οδηγίες",
          paragraphs: [
            "Για τη φιλοξενία, οι οδηγίες του ζευγαριού είναι οι ενέργειες που προσφέρει το προϊόν: δημιουργία και επεξεργασία εκδήλωσης, επιλογή απορρήτου και λήψης, πρόσκληση με τον σύνδεσμο, απόκρυψη ή διαγραφή μέσων, διαγραφή εκδήλωσης και διαγραφή λογαριασμού. Ο υπεύθυνος λειτουργίας δεν πρέπει να χρησιμοποιεί τα αρχεία για διαφήμιση. Αυτή η εφαρμογή δεν το κάνει.",
          ],
        },
        {
          heading: "Εμπιστευτικότητα και ασφάλεια",
          paragraphs: [
            "Όσοι λειτουργούν την υπηρεσία πρέπει να ανοίγουν στοιχεία πελατών μόνο όταν χρειάζεται. Τα μέτρα στον κώδικα σήμερα περιλαμβάνουν σύνδεση για τα ζευγάρια, ξεχωριστή πρόσβαση διαχειριστή, ιδιωτικό αποθηκευτικό χώρο, συνδέσμους μέσων μικρής διάρκειας, httpOnly αναγνωριστικά καλεσμένων, κανόνες κωδικού, ανάκληση συνεδριών στην επαναφορά κωδικού, όρια ρυθμού και καταγραφές που δεν κρατούν κείμενο μηνύματος ή email. Αυτά περιγράφουν τον κώδικα, δεν είναι πιστοποίηση.",
          ],
        },
        {
          heading: "Υπεργολάβοι",
          paragraphs: [
            "Όταν είναι ρυθμισμένα, η εφαρμογή χρησιμοποιεί PostgreSQL, Cloudflare R2, Resend, Upstash, και είναι γραμμένη για φιλοξενία στη Vercel. Μια συμφωνία επεξεργασίας χρειάζεται ο υπεύθυνος λειτουργίας να επιβεβαιώσει ποια από αυτά χρησιμοποιούνται στην παραγωγή, σε ποια περιοχή και με ποια σύμβαση. Στην ανάπτυξη τα αρχεία μπορούν να αποθηκεύονται στον διακομιστή της εφαρμογής αντί για R2. Κανένας άλλος υπεργολάβος δεν συνδέεται σε αυτόν τον κώδικα.",
          ],
        },
        {
          heading: "Αιτήματα, περιστατικά και διαγραφή",
          paragraphs: [
            "Ο υπεύθυνος λειτουργίας θα χρειαστεί διαδικασία για αιτήματα ανθρώπων που εμφανίζονται σε φωτογραφίες και για αιτήματα ζευγαριών. Το email επικοινωνίας δεν έχει δημοσιευτεί, και το προσχέδιο δεν ορίζει χρόνο απάντησης.",
            "Το προσχέδιο δεν υπόσχεται ειδοποίηση του ζευγαριού μέσα σε συγκεκριμένες ώρες μετά από περιστατικό. Το καθήκον ειδοποίησης, και ποιος ειδοποιεί εποπτική αρχή, πρέπει να το προσθέσει δικηγόρος.",
            "Η διαγραφή εκδήλωσης ή λογαριασμού αφαιρεί τις σχετικές γραμμές και τα αρχεία αντικειμένων όπως περιγράφει η πολιτική απορρήτου. Αν ο διαχειριστής δεν παρατείνει την πρόσβαση ενός πελάτη πριν λήξει, ο ίδιος καθαρισμός διαγράφει τις εκδηλώσεις και τα αποθηκευμένα αρχεία του πελάτη και αφήνει τον λογαριασμό απενεργοποιημένο. Τα αντίγραφα ασφαλείας υποδομής ή παρόχων είναι έξω από αυτή τη διαγραφή, οπότε η εφαρμογή δεν μπορεί να εγγυηθεί ότι κάθε αντίγραφο σβήνεται αμέσως. Στη λήξη της σχέσης, η ίδια διαδρομή διαγραφής είναι ό,τι μπορεί να κάνει σήμερα η εφαρμογή. Δεν έχει υλοποιηθεί πλήρης εξαγωγή για επιστροφή.",
          ],
        },
        {
          heading: "Έλεγχος",
          paragraphs: [
            "Το προσχέδιο δεν παρέχει συγκεκριμένο δικαίωμα ελέγχου, συχνότητα ή κόστος. Ο υπεύθυνος λειτουργίας και ένας δικηγόρος πρέπει να προσθέσουν τη ρήτρα αν τη χρειάζεται ένας πελάτης. Δεν υπάρχει οθόνη καταγραφών στο προϊόν.",
          ],
        },
      ],
    },
  },
};

export const privacyCopy = { en, el } as const;

export function privacyLanguage(locale: string): keyof typeof privacyCopy {
  return locale === "en" ? "en" : "el";
}
