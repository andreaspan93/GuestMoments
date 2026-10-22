"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { GalleryViewer, ViewerIconButton } from "@/components/gallery-viewer";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { GALLERY_REFRESH_MS, type GalleryItem } from "@/lib/gallery/present";

export function GuestGallery({
  code,
  locale,
  initialItems,
  initialOwnUploadCount,
  downloadsEnabled,
}: {
  code: string;
  locale: GuestLocale;
  initialItems: GalleryItem[];
  initialOwnUploadCount: number;
  downloadsEnabled: boolean;
}) {
  const copy = guestChrome[locale];
  const [items, setItems] = useState(initialItems);
  const [ownUploadCount, setOwnUploadCount] = useState(initialOwnUploadCount);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const hasOwnUploads = ownUploadCount > 0;
  const current = openIndex !== null ? items[openIndex] : null;

  useEffect(() => {
    let active = true;

    async function load() {
      if (document.visibilityState !== "visible") {
        return;
      }

      const response = await fetch(`/api/e/${code}/gallery`, {
        credentials: "same-origin",
      });

      if (!response.ok || !active) {
        return;
      }

      const body = (await response.json()) as { items?: GalleryItem[]; ownUploadCount?: number };

      if (body.items) {
        setItems(body.items);
      }

      if (typeof body.ownUploadCount === "number") {
        setOwnUploadCount(body.ownUploadCount);
      }
    }

    function refresh() {
      void load();
    }

    const timer = window.setInterval(refresh, GALLERY_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("guestmoments-gallery-refresh", refresh);

    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("guestmoments-gallery-refresh", refresh);
    };
  }, [code]);

  async function download(id: string) {
    const response = await fetch(`/api/e/${code}/media/${id}/download`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      return;
    }

    const body = (await response.json()) as { url?: string };

    if (body.url) {
      const anchor = document.createElement("a");
      anchor.href = body.url;
      anchor.rel = "noopener";
      anchor.click();
    }
  }

  async function removeOwn(id: string) {
    if (pending || !window.confirm(copy.deleteOwnConfirm)) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/e/${code}/media/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError(copy.deleteFailed);
        return;
      }

      setOpenIndex(null);
      setOwnUploadCount((count) => Math.max(0, count - 1));
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } finally {
      setPending(false);
    }
  }

  async function removeAllOwn() {
    if (pending || !hasOwnUploads || !window.confirm(copy.deleteAllOwnConfirm)) {
      return;
    }

    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/e/${code}/media/delete`, {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        setError(copy.deleteFailed);
        return;
      }

      setOpenIndex(null);
      setOwnUploadCount(0);
      setItems((currentItems) => currentItems.filter((item) => !item.owned));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium tracking-wide uppercase">{copy.galleryTitle}</h2>
        {hasOwnUploads ? (
          <button
            type="button"
            className="h-10 rounded-full border border-border bg-card px-4 text-sm font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            onClick={() => void removeAllOwn()}
          >
            {copy.deleteAllOwn}
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/80">{copy.galleryEmpty}</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="relative min-w-0 overflow-hidden rounded-2xl border border-border bg-card"
            >
              <button type="button" className="block w-full text-left" onClick={() => setOpenIndex(index)}>
                <span className="relative block aspect-square overflow-hidden bg-muted">
                  {item.previewUrl ? (
                    // Signed storage URL; the image optimizer is not used.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="absolute inset-0 size-full object-cover object-center"
                      src={item.previewUrl}
                      alt=""
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center px-3 text-center text-sm break-words">
                      {item.type === "video" ? copy.video : item.originalFileName}
                    </span>
                  )}
                </span>
                <span className="line-clamp-2 block h-12 overflow-hidden px-2 py-1.5 text-xs leading-4 sm:h-14 sm:px-3 sm:py-2 sm:text-sm sm:leading-5">
                  {item.guestName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {openIndex !== null ? (
        <GalleryViewer
          items={items}
          index={openIndex}
          labels={{
            close: copy.close,
            previous: copy.previous,
            next: copy.next,
            download: copy.download,
            cannotPlay: copy.cannotPlay,
          }}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
          allowDownload={downloadsEnabled}
          onDownload={(id) => void download(id)}
          actions={
            current?.owned ? (
              <ViewerIconButton
                label={copy.deleteOwn}
                destructive
                onClick={() => void removeOwn(current.id)}
              >
                <Trash2 className="size-5" aria-hidden="true" />
              </ViewerIconButton>
            ) : null
          }
        />
      ) : null}
    </section>
  );
}
