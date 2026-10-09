"use client";

import { useState } from "react";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { createThumbnail, normalizeUploadFile } from "@/lib/uploads/browser-file";
import { putBytesWithRetry } from "@/lib/uploads/transfer";
import { FilePicker } from "@/components/file-picker";
import { Button } from "@/components/ui/button";

type UploadCopy = (typeof guestChrome)[GuestLocale];

type UploadItem = {
  id: string;
  name: string;
  previewUrl: string | null;
  kind: "image" | "video" | "file";
  progress: number;
  status: "ready" | "uploading" | "done" | "error";
  message: string;
};

function errorMessage(code: string, copy: UploadCopy) {
  if (code === "quota") {
    return copy.uploadQuota;
  }

  if (code === "type") {
    return copy.uploadType;
  }

  if (code === "oversize") {
    return copy.uploadOversize;
  }

  if (code === "rate") {
    return copy.uploadRate;
  }

  if (code === "unavailable") {
    return copy.unavailable;
  }

  return copy.uploadFailed;
}

async function requestIntent(
  code: string,
  file: { name: string; type: string; size: number },
  kind: "original" | "thumbnail",
) {
  const response = await fetch(`/api/e/${code}/uploads`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      contentType: file.type,
      contentLength: file.size,
      kind,
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

  return {
    intentId: body.intentId,
    url: body.url,
    contentType: body.headers["Content-Type"],
  };
}

export function GuestUploader({
  code,
  locale,
  accentColor,
}: {
  code: string;
  locale: GuestLocale;
  accentColor: string;
}) {
  const copy = guestChrome[locale];
  const [guestName, setGuestName] = useState("");
  const [guestMessage, setGuestMessage] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);
  const [pending, setPending] = useState(false);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  async function onFiles(list: FileList | null) {
    const next: UploadItem[] = [];

    for (const file of Array.from(list ?? [])) {
      const kind = file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("image/") || /\.hei[cf]$/i.test(file.name)
          ? "image"
          : "file";
      next.push({
        id: crypto.randomUUID(),
        name: file.name,
        previewUrl: kind === "file" ? null : URL.createObjectURL(file),
        kind,
        progress: 0,
        status: "ready",
        message: "",
      });
    }

    setItems(next);
  }

  async function uploadOne(item: UploadItem, file: File) {
    updateItem(item.id, { status: "uploading", progress: 0, message: copy.uploadPending });
    const normalized = await normalizeUploadFile(file);
    const original = await requestIntent(code, normalized, "original");
    const attempts = normalized.type.startsWith("video/") ? 3 : 1;
    await putBytesWithRetry(original.url, normalized, original.contentType, attempts, (ratio) => {
      updateItem(item.id, { progress: Math.round(ratio * 90) });
    });

    let thumbnailIntentId: string | undefined;
    const thumbnail = await createThumbnail(normalized);

    if (thumbnail) {
      try {
        const thumbFile = new File([thumbnail], "thumbnail.jpg", { type: "image/jpeg" });
        const thumbIntent = await requestIntent(code, thumbFile, "thumbnail");
        await putBytesWithRetry(thumbIntent.url, thumbnail, thumbIntent.contentType, 1, () => {});
        thumbnailIntentId = thumbIntent.intentId;
      } catch {
        thumbnailIntentId = undefined;
      }
    }

    const complete = await fetch(`/api/e/${code}/uploads/${original.intentId}/complete`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName,
        guestMessage,
        thumbnailIntentId,
      }),
    });
    const body = (await complete.json()) as { error?: string };

    if (!complete.ok) {
      throw new Error(body.error ?? "intent");
    }

    updateItem(item.id, { status: "done", progress: 100, message: copy.uploadDone });
    window.dispatchEvent(new Event("guestmoments-gallery-refresh"));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("files");

    if (!(input instanceof HTMLInputElement) || !input.files?.length) {
      return;
    }

    setPending(true);
    const files = Array.from(input.files);

    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      const file = files[index];

      if (!item || !file || item.status === "done") {
        continue;
      }

      try {
        await uploadOne(item, file);
      } catch (error) {
        const codeName = error instanceof Error ? error.message : "";
        updateItem(item.id, {
          status: "error",
          message: errorMessage(codeName, copy),
        });
      }
    }

    setPending(false);
  }

  return (
    <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
      <h2 className="text-sm font-medium tracking-wide uppercase" style={{ color: accentColor }}>
        {copy.uploadTitle}
      </h2>
      <label className="grid gap-2 text-sm font-medium">
        {copy.guestName}
        <input
          className="h-10 rounded-full border border-border bg-background px-4 text-base"
          name="guestName"
          maxLength={80}
          value={guestName}
          onChange={(event) => setGuestName(event.target.value)}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium">
        {copy.guestMessage}
        <textarea
          className="min-h-20 rounded-2xl border border-border bg-background px-4 py-3 text-base"
          name="guestMessage"
          maxLength={500}
          value={guestMessage}
          onChange={(event) => setGuestMessage(event.target.value)}
        />
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{copy.uploadPick}</p>
        <FilePicker
          name="files"
          multiple
          buttonLabel={copy.uploadChoose}
          emptyLabel={copy.uploadEmpty}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,.mp4,.mov"
          formatSelection={(files) =>
            files.length === 1 ? files[0].name : `${files.length} ${copy.uploadCount}`
          }
          onFiles={onFiles}
        />
      </div>
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-background p-3">
            {item.previewUrl && item.kind === "video" ? (
              <video className="mb-2 max-h-40 rounded-xl" src={item.previewUrl} controls />
            ) : null}
            {item.previewUrl && item.kind === "image" ? (
              // Local preview; the image optimizer is not used.
              // eslint-disable-next-line @next/next/no-img-element
              <img className="mb-2 max-h-40 rounded-xl object-cover" src={item.previewUrl} alt="" />
            ) : null}
            <p className="text-sm font-medium">{item.name}</p>
            {item.status === "uploading" || item.status === "done" || item.status === "error" ? (
              <p className="mt-1 text-sm text-foreground/80" role="status">
                {item.message}
                {item.status === "uploading" ? ` ${item.progress}%` : ""}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending || items.length === 0}>
        {pending ? copy.uploadPending : copy.uploadSubmit}
      </Button>
    </form>
  );
}
