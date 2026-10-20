"use client";

import { useEffect, useRef, useState } from "react";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { createThumbnail, prepareGuestUpload } from "@/lib/uploads/browser-file";
import { isHeicFile, isVideoFile } from "@/lib/uploads/image-prepare";
import {
  claimFileStart,
  claimUploadStart,
  filesStillPending,
  GUEST_UPLOAD_CONCURRENCY,
  GUEST_UPLOAD_REDIRECT_MS,
  guestEventPath,
  mapWithConcurrency,
  transferPercent,
  uploadBatchSummary,
  type UploadStatus,
} from "@/lib/uploads/guest-upload-flow";
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
  progressKnown: boolean;
  status: UploadStatus;
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
  const [uploaded, setUploaded] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const inProgress = useRef(false);
  const redirectTimer = useRef<number | null>(null);
  const filesRef = useRef<Map<string, File>>(new Map());
  const activeIds = useRef(new Set<string>());
  const itemsRef = useRef(items);

  useEffect(() => {
    return () => {
      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current);
      }

      for (const item of itemsRef.current) {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl);
        }
      }
    };
  }, []);

  function updateItem(id: string, patch: Partial<UploadItem>) {
    setItems((current) => {
      const next = current.map((item) => (item.id === id ? { ...item, ...patch } : item));
      itemsRef.current = next;

      return next;
    });
  }

  function onFiles(list: FileList | null) {
    for (const item of itemsRef.current) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }

    const files = new Map<string, File>();
    const next: UploadItem[] = [];

    for (const file of Array.from(list ?? [])) {
      const id = crypto.randomUUID();
      const kind = isVideoFile(file) ? "video" : isHeicFile(file) || file.type.startsWith("image/") ? "image" : "file";
      files.set(id, file);
      next.push({
        id,
        name: file.name,
        previewUrl: kind === "file" ? null : URL.createObjectURL(file),
        kind,
        progress: 0,
        progressKnown: false,
        status: "ready",
        message: "",
      });
    }

    filesRef.current = files;
    itemsRef.current = next;
    setItems(next);
  }

  async function uploadOne(item: UploadItem, file: File) {
    updateItem(item.id, {
      status: "uploading",
      progress: 0,
      progressKnown: false,
      message: copy.uploadPreparing,
    });
    const normalized = await prepareGuestUpload(file);
    updateItem(item.id, { name: normalized.name, message: copy.uploadPending });
    const original = await requestIntent(code, normalized, "original");
    const attempts = normalized.type.startsWith("video/") ? 3 : 1;
    let planned = normalized.size;
    await putBytesWithRetry(original.url, normalized, original.contentType, attempts, (ratio) => {
      const percent = transferPercent(ratio * normalized.size, planned);

      if (percent === null) {
        return;
      }

      updateItem(item.id, {
        progress: percent,
        progressKnown: true,
        message: copy.uploadPending,
      });
    });

    let thumbnailIntentId: string | undefined;
    const thumbnail = await createThumbnail(normalized);

    if (thumbnail) {
      try {
        const thumbFile = new File([thumbnail], "thumbnail.jpg", { type: "image/jpeg" });
        planned = normalized.size + thumbFile.size;
        const thumbIntent = await requestIntent(code, thumbFile, "thumbnail");
        await putBytesWithRetry(thumbIntent.url, thumbnail, thumbIntent.contentType, 1, (ratio) => {
          const percent = transferPercent(normalized.size + ratio * thumbFile.size, planned);

          if (percent === null) {
            return;
          }

          updateItem(item.id, {
            progress: percent,
            progressKnown: true,
            message: copy.uploadPending,
          });
        });
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

    updateItem(item.id, { status: "done", progress: 100, progressKnown: true, message: copy.uploadDone });
    window.dispatchEvent(new Event("guestmoments-gallery-refresh"));
  }

  function resetSelection(current: UploadItem[]) {
    for (const item of current) {
      if (item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
    }

    filesRef.current = new Map();
    setGuestName("");
    setGuestMessage("");
    itemsRef.current = [];
    setItems([]);
    setPickerKey((key) => key + 1);
  }

  async function runBatch(ids: readonly string[]) {
    const queue = itemsRef.current.filter((item) => ids.includes(item.id) && item.status !== "done");

    if (queue.length === 0) {
      return;
    }

    const queuedIds = new Set(queue.map((item) => item.id));
    setItems((current) => {
      const next = current.map((item) =>
        queuedIds.has(item.id)
          ? {
              ...item,
              status: "waiting" as const,
              progress: 0,
              progressKnown: false,
              message: copy.uploadWaiting,
            }
          : item,
      );
      itemsRef.current = next;

      return next;
    });

    await mapWithConcurrency(queue, GUEST_UPLOAD_CONCURRENCY, async (item) => {
      const latest = itemsRef.current.find((entry) => entry.id === item.id);

      if (!latest || !claimFileStart(activeIds.current, latest.id, latest.status)) {
        return;
      }

      const file = filesRef.current.get(item.id);
      activeIds.current.add(item.id);

      try {
        if (!file) {
          throw new Error("intent");
        }

        await uploadOne(latest, file);
      } catch (error) {
        const codeName = error instanceof Error ? error.message : "";
        updateItem(item.id, {
          status: "error",
          progressKnown: false,
          message: errorMessage(codeName, copy),
        });
      } finally {
        activeIds.current.delete(item.id);
      }
    });
  }

  function finishBatch() {
    const summary = uploadBatchSummary(itemsRef.current);

    if (summary.allSucceeded) {
      resetSelection(itemsRef.current);
      setUploaded(true);

      if (redirectTimer.current !== null) {
        window.clearTimeout(redirectTimer.current);
      }

      redirectTimer.current = window.setTimeout(() => {
        window.location.assign(guestEventPath(code));
      }, GUEST_UPLOAD_REDIRECT_MS);

      return;
    }

    inProgress.current = false;
    setPending(false);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!claimUploadStart(inProgress.current)) {
      return;
    }

    const ids = filesStillPending(itemsRef.current.map((item) => item.status)).map(
      (index) => itemsRef.current[index]?.id,
    ).filter((id): id is string => Boolean(id));

    if (ids.length === 0) {
      return;
    }

    inProgress.current = true;
    setPending(true);
    setUploaded(false);
    await runBatch(ids);
    finishBatch();
  }

  async function retryFile(id: string) {
    if (!claimUploadStart(inProgress.current)) {
      return;
    }

    const item = itemsRef.current.find((entry) => entry.id === id);

    if (!item || item.status !== "error") {
      return;
    }

    inProgress.current = true;
    setPending(true);
    setUploaded(false);
    await runBatch([id]);
    finishBatch();
  }

  const summary = uploadBatchSummary(items);
  const showProgress = items.some((item) => item.status !== "ready");

  return (
    <form className="mt-8 grid gap-4" onSubmit={onSubmit}>
      {uploaded ? (
        <p role="status" className="rounded-2xl border border-border bg-background px-4 py-3 text-sm">
          {copy.uploadSuccess}
        </p>
      ) : null}
      <h2 className="text-sm font-medium tracking-wide uppercase" style={{ color: accentColor }}>
        {copy.uploadTitle}
      </h2>
      <label className="grid gap-2 text-sm font-medium">
        {copy.guestName}
        <input
          className="h-10 rounded-full border border-border bg-background px-4 text-base"
          name="guestName"
          maxLength={80}
          disabled={pending}
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
          disabled={pending}
          value={guestMessage}
          onChange={(event) => setGuestMessage(event.target.value)}
        />
      </label>
      <div className="grid gap-2">
        <p className="text-sm font-medium">{copy.uploadPick}</p>
        <FilePicker
          key={pickerKey}
          name="files"
          multiple
          disabled={pending}
          buttonLabel={copy.uploadChoose}
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif,video/mp4,video/quicktime,.mp4,.mov"
          formatSelection={(files) =>
            files.length === 1 ? files[0].name : `${files.length} ${copy.uploadCount}`
          }
          onFiles={onFiles}
        />
      </div>
      {showProgress ? (
        <div className="grid gap-2">
          <p className="text-sm font-medium" role="status">
            {summary.completed} {copy.uploadOf} {summary.total}
          </p>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(summary.ratio * 100)}
            aria-label={copy.uploadTitle}
          >
            <div
              className="h-full"
              style={{ width: `${Math.round(summary.ratio * 100)}%`, backgroundColor: accentColor }}
            />
          </div>
          {summary.settled && summary.failed > 0 ? (
            <p role="status" className="text-sm text-foreground/80">
              {copy.uploadPartial}
            </p>
          ) : null}
        </div>
      ) : null}
      <ul className="grid max-h-[28rem] gap-3 overflow-y-auto">
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
            <p className="text-sm font-medium break-words">{item.name}</p>
            {item.status !== "ready" ? (
              <p className="mt-1 text-sm text-foreground/80">
                {item.status === "waiting" ? copy.uploadWaiting : null}
                {item.status === "uploading"
                  ? item.progressKnown
                    ? `${copy.uploadPending} ${item.progress}%`
                    : item.message
                  : null}
                {item.status === "done" ? copy.uploadDone : null}
                {item.status === "error" ? item.message : null}
              </p>
            ) : null}
            {item.progressKnown && (item.status === "uploading" || item.status === "done") ? (
              <div
                className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={item.status === "done" ? 100 : item.progress}
                aria-label={item.name}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${item.status === "done" ? 100 : item.progress}%`,
                    backgroundColor: accentColor,
                  }}
                />
              </div>
            ) : null}
            {item.status === "error" ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                disabled={pending}
                onClick={() => void retryFile(item.id)}
              >
                {copy.uploadRetry}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <Button type="submit" disabled={pending || items.length === 0} aria-busy={pending}>
        {pending ? copy.uploadPending : copy.uploadSubmit}
      </Button>
    </form>
  );
}
