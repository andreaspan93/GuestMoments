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
