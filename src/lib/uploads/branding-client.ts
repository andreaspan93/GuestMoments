import { putBytesWithRetry } from "@/lib/uploads/transfer";

const slots = ["cover", "logo", "background"] as const;

export type BrandingSlot = (typeof slots)[number];

export const brandingSlots = slots;

export async function uploadBrandingFile(eventId: string, slot: BrandingSlot, file: File) {
  const response = await fetch(`/api/events/${eventId}/branding`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      slot,
      fileName: file.name,
      contentType: file.type,
      contentLength: file.size,
    }),
  });
  const body = (await response.json()) as {
    error?: string;
    intentId?: string;
    url?: string;
    headers?: { "Content-Type": string };
  };

  if (!response.ok || !body.intentId || !body.url || !body.headers) {
    throw new Error(body.error ?? "intent");
  }

  await putBytesWithRetry(body.url, file, body.headers["Content-Type"], 1, () => {});
  const complete = await fetch(`/api/events/${eventId}/branding/${body.intentId}/complete`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!complete.ok) {
    throw new Error("intent");
  }
}
