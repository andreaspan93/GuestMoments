"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { GalleryItem } from "@/lib/gallery/present";
import { cn } from "@/lib/utils";

export function ViewerIconButton({
  label,
  onClick,
  children,
  pressed,
  destructive = false,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex size-11 shrink-0 items-center justify-center rounded-full border border-white/40 text-white",
        destructive && "border-red-300 text-red-200",
        pressed && "bg-white text-black",
      )}
    >
      {children}
    </button>
  );
}

type ViewerLabels = {
  close: string;
  previous: string;
  next: string;
  download: string;
  cannotPlay: string;
};

export function GalleryViewer({
  items,
  index,
  labels,
  onClose,
  onIndex,
  onDownload,
  actions,
}: {
  items: GalleryItem[];
  index: number;
  labels: ViewerLabels;
  onClose: () => void;
  onIndex: (index: number) => void;
  onDownload: (id: string) => void;
  actions?: ReactNode;
}) {
  const item = items[index];
  const dialogRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const [failedId, setFailedId] = useState<string | null>(null);
  const playbackFailed = failedId === item?.id;

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }

      if (event.key === "ArrowLeft") {
        onIndex((index - 1 + items.length) % items.length);
      }

      if (event.key === "ArrowRight") {
        onIndex((index + 1) % items.length);
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onIndex]);

  if (!item) {
    return null;
  }

  const canPlay =
    item.type === "video" &&
    !playbackFailed &&
    browserCanPlay(item.mimeType) &&
    Boolean(item.playbackUrl);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={item.originalFileName}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col bg-black/85 p-4 text-white"
      onTouchStart={(event) => {
        startX.current = event.changedTouches[0]?.clientX ?? 0;
      }}
      onTouchEnd={(event) => {
        const endX = event.changedTouches[0]?.clientX ?? startX.current;
        const delta = endX - startX.current;

        if (delta > 48) {
          onIndex((index - 1 + items.length) % items.length);
        }

        if (delta < -48) {
          onIndex((index + 1) % items.length);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">{item.originalFileName}</p>
        <button type="button" className="rounded-full px-3 py-2 text-sm" onClick={onClose}>
          {labels.close}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-4">
        {item.type === "photo" && (item.playbackUrl || item.previewUrl) ? (
          // Signed storage URL; the image optimizer is not used.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="max-h-full max-w-full object-contain"
            src={item.playbackUrl ?? item.previewUrl ?? ""}
            alt=""
          />
        ) : null}
        {canPlay ? (
          <video
            key={item.id}
            className="max-h-full max-w-full"
            src={item.playbackUrl ?? undefined}
            controls
            playsInline
            onError={() => setFailedId(item.id)}
          />
        ) : null}
        {item.type === "video" && !canPlay ? (
          <p className="max-w-md text-center text-sm leading-6">{labels.cannotPlay}</p>
        ) : null}
      </div>
      {item.guestName || item.guestMessage ? (
        <p className="text-center text-sm leading-6">
          {item.guestName}
          {item.guestName && item.guestMessage ? " — " : ""}
          {item.guestMessage}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
        {items.length > 1 ? (
          <div className="inline-flex gap-1">
            <ViewerIconButton
              label={labels.previous}
              onClick={() => onIndex((index - 1 + items.length) % items.length)}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </ViewerIconButton>
            <ViewerIconButton
              label={labels.next}
              onClick={() => onIndex((index + 1) % items.length)}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </ViewerIconButton>
          </div>
        ) : null}
        <ViewerIconButton label={labels.download} onClick={() => onDownload(item.id)}>
          <Download className="size-5" aria-hidden="true" />
        </ViewerIconButton>
        {actions}
      </div>
    </div>
  );
}

function browserCanPlay(mimeType: string) {
  const video = document.createElement("video");
  const support = video.canPlayType(mimeType);

  return support === "probably" || support === "maybe";
}
