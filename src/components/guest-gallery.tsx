"use client";

import { useEffect, useState } from "react";
import { CheckCheck, SquareMinus, Trash2 } from "lucide-react";
import { GalleryViewer, ViewerIconButton } from "@/components/gallery-viewer";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { deliverMediaDownload, isPhoneDevice } from "@/lib/gallery/photo-library";
import { GALLERY_REFRESH_MS, type GalleryItem } from "@/lib/gallery/present";
import { cn } from "@/lib/utils";

export function GuestGallery({
  code,
  locale,
  initialItems,
  downloadsEnabled,
}: {
  code: string;
  locale: GuestLocale;
  initialItems: GalleryItem[];
  downloadsEnabled: boolean;
}) {
  const copy = guestChrome[locale];
  const [items, setItems] = useState(initialItems);
  const [selected, setSelected] = useState<string[]>([]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const ownedIds = items.filter((item) => item.owned).map((item) => item.id);
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

      const body = (await response.json()) as { items?: GalleryItem[] };

      if (body.items) {
        const nextItems = body.items;
        setItems(nextItems);
        setSelected((currentIds) =>
          currentIds.filter((id) => nextItems.some((item) => item.id === id && item.owned)),
        );
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

    if (!body.url) {
      return;
    }

    const item = items.find((entry) => entry.id === id);
    const outcome = await deliverMediaDownload({
      url: body.url,
      fileName: item?.originalFileName || "photo.jpg",
      mimeType: item?.mimeType || "image/jpeg",
      isPhone: isPhoneDevice(),
      fetchFile: async () => {
        const fileResponse = await fetch(`/api/e/${code}/media/${id}/file`, {
          credentials: "same-origin",
        });

        if (!fileResponse.ok) {
          throw new Error("file");
        }

        return fileResponse.blob();
      },
      canShare: (file) => Boolean(navigator.canShare?.({ files: [file] })),
      share: (file) => navigator.share({ files: [file] }),
      saveDownload: (href) => {
        const anchor = document.createElement("a");
        anchor.href = href;
        anchor.rel = "noopener";
        anchor.click();
      },
    });

    if (outcome === "cancelled") {
      return;
    }
  }

  function toggleSelected(id: string) {
    setSelected((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((itemId) => itemId !== id) : [...currentIds, id],
    );
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
      setSelected((currentIds) => currentIds.filter((itemId) => itemId !== id));
      setItems((currentItems) => currentItems.filter((item) => item.id !== id));
    } finally {
      setPending(false);
    }
  }

  async function removeSelected() {
    if (pending || selected.length === 0 || !window.confirm(copy.deleteSelectedConfirm)) {
      return;
    }

    const mediaIds = selected;
    setPending(true);
    setError("");

    try {
      const response = await fetch(`/api/e/${code}/media/delete`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds }),
      });

      if (!response.ok) {
        setError(copy.deleteFailed);
        return;
      }

      setOpenIndex((index) => {
        const openItem = index !== null ? items[index] : null;
        return openItem && mediaIds.includes(openItem.id) ? null : index;
      });
      setSelected([]);
      setItems((currentItems) => currentItems.filter((item) => !mediaIds.includes(item.id)));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-medium tracking-wide uppercase">{copy.galleryTitle}</h2>
        {selected.length > 0 ? (
          <div className="flex w-full flex-nowrap items-center gap-1.5 sm:w-auto">
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={copy.selectAll}
              title={copy.selectAll}
              disabled={pending}
              onClick={() => setSelected(ownedIds)}
            >
              <CheckCheck className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={copy.deselectAll}
              title={copy.deselectAll}
              disabled={pending}
              onClick={() => setSelected([])}
            >
              <SquareMinus className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="h-9 min-w-0 flex-1 rounded-full border border-border bg-card px-2 text-xs font-medium whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
              disabled={pending}
              onClick={() => void removeSelected()}
            >
              {copy.deleteSelected}
            </button>
          </div>
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
          {items.map((item, index) => {
            const isSelected = selected.includes(item.id);

            return (
              <li
                key={item.id}
                className={cn(
                  "relative min-w-0 overflow-hidden rounded-2xl border bg-card",
                  isSelected ? "border-primary ring-2 ring-primary" : "border-border",
                )}
              >
                {isSelected ? (
                  <span className="pointer-events-none absolute inset-0 z-[1] bg-primary/15" />
                ) : null}
                {item.owned ? (
                  <label className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={isSelected}
                      aria-label={copy.select}
                      disabled={pending}
                      onChange={() => toggleSelected(item.id)}
                    />
                    <span
                      className={cn(
                        "flex size-10 items-center justify-center rounded-full border text-transparent shadow-sm",
                        "border-white/90 bg-black/35 peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground",
                        "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2",
                      )}
                    >
                      <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
                        <path
                          d="M3.5 8.5 6.5 11.5 12.5 4.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </label>
                ) : null}
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
            );
          })}
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
