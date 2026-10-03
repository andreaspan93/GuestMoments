import { Resend } from "resend";

type ResetEmail = {
  to: string;
  url: string;
  locale: "el" | "en";
};

const copy = {
  el: {
    subject: "Επαναφορά κωδικού GuestMoments",
    text: (url: string) =>
      `Ζητήσατε επαναφορά του κωδικού σας. Ανοίξτε αυτόν τον σύνδεσμο για να ορίσετε νέο κωδικό:\n\n${url}\n\nΑν δεν το ζητήσατε εσείς, αγνοήστε αυτό το μήνυμα.`,
  },
  en: {
    subject: "Reset your GuestMoments password",
    text: (url: string) =>
      `You asked to reset your password. Open this link to choose a new one:\n\n${url}\n\nIf you did not ask for this, you can ignore this message.`,
  },
} as const;

type VerificationEmail = ResetEmail;

const verificationCopy = {
  el: {
    subject: "Επιβεβαίωση email GuestMoments",
    text: (url: string) =>
      `Επιβεβαιώστε το email του λογαριασμού σας ανοίγοντας αυτόν τον σύνδεσμο:\n\n${url}\n\nΑν δεν δημιουργήσατε εσείς λογαριασμό, αγνοήστε αυτό το μήνυμα.`,
  },
  en: {
    subject: "Verify your GuestMoments email",
    text: (url: string) =>
      `Verify your account email by opening this link:\n\n${url}\n\nIf you did not create an account, you can ignore this message.`,
  },
} as const;

export const verificationDeliveries: VerificationEmail[] = [];

export async function sendVerificationEmail({ to, url, locale }: VerificationEmail) {
  const message = verificationCopy[locale];
  const apiKey = process.env.RESEND_API_KEY;

  if (process.env.NODE_ENV === "test") {
    verificationDeliveries.push({ to, url, locale });
  }

  if (!apiKey) {
    if (process.env.NODE_ENV === "development") {
      console.info(`[email-verification] ${to} ${url}`);
    }

    return;
  }

  if (process.env.NODE_ENV === "test") {
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "GuestMoments <onboarding@resend.dev>",
    to,
    subject: message.subject,
    text: message.text(url),
  });
}

export async function sendPasswordResetEmail({ to, url, locale }: ResetEmail) {
  const message = copy[locale];
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.info(`[password-reset] ${to} ${url}`);
    return;
  }

  const resend = new Resend(apiKey);
  await resend.emails.send({
    from: process.env.EMAIL_FROM ?? "GuestMoments <onboarding@resend.dev>",
    to,
    subject: message.subject,
    text: message.text(url),
  });
}
