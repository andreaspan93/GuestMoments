"use client";

import { useEffect, useState } from "react";
import { GalleryViewer } from "@/components/gallery-viewer";
import { guestChrome, type GuestLocale } from "@/lib/events/text";
import { GALLERY_REFRESH_MS, type GalleryItem } from "@/lib/gallery/present";

export function GuestGallery({
  code,
  locale,
  initialItems,
}: {
  code: string;
  locale: GuestLocale;
  initialItems: GalleryItem[];
}) {
  const copy = guestChrome[locale];
  const [items, setItems] = useState(initialItems);
  const [openIndex, setOpenIndex] = useState<number | null>(null);

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
        setItems(body.items);
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

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium tracking-wide uppercase">{copy.galleryTitle}</h2>
      {items.length === 0 ? (
        <p className="mt-4 text-sm text-foreground/80">{copy.galleryEmpty}</p>
      ) : (
        <div className="mt-4 columns-2 gap-3">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl bg-background text-left"
              onClick={() => setOpenIndex(index)}
            >
              {item.previewUrl ? (
                // Signed storage URL; the image optimizer is not used.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="w-full object-cover" src={item.previewUrl} alt="" />
              ) : (
                <span className="flex h-28 items-center justify-center px-3 text-sm">
                  {item.type === "video" ? copy.video : item.originalFileName}
                </span>
              )}
              {item.guestName ? (
                <span className="block px-3 py-2 text-sm">{item.guestName}</span>
              ) : null}
            </button>
          ))}
        </div>
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
          onDownload={(id) => void download(id)}
        />
      ) : null}
    </section>
  );
}
