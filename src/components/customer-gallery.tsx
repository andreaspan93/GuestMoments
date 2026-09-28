"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GalleryViewer } from "@/components/gallery-viewer";
import type { CustomerGalleryItem } from "@/lib/gallery/present";

export function CustomerGallery({
  eventId,
  initialItems,
}: {
  eventId: string;
  initialItems: CustomerGalleryItem[];
}) {
  const t = useTranslations("events");
  const [items, setItems] = useState(initialItems);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load(nextSort = sort) {
    const response = await fetch(`/api/events/${eventId}/gallery?sort=${nextSort}`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    const body = (await response.json()) as { items?: CustomerGalleryItem[] };

    if (body.items) {
      setItems(body.items);
      setError("");
    }
  }

  async function chooseSort(next: "newest" | "oldest") {
    setSort(next);
    setOpenIndex(null);
    await load(next);
  }

  async function mutate(id: string, action: "hide" | "unhide" | "favorite" | "unfavorite") {
    const response = await fetch(`/api/events/${eventId}/media/${id}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    await load();
  }

  async function remove(id: string) {
    if (!window.confirm(t("deleteMediaConfirm"))) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/media/${id}`, {
      method: "DELETE",
      credentials: "same-origin",
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    setOpenIndex(null);
    await load();
  }

  async function download(id: string) {
    const response = await fetch(`/api/events/${eventId}/media/${id}/download`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    const body = (await response.json()) as { url?: string };

    if (!body.url) {
      return;
    }

    const anchor = document.createElement("a");
    anchor.href = body.url;
    anchor.rel = "noopener";
    anchor.click();
  }

  const current = openIndex === null ? null : items[openIndex];

  return (
    <section>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-full border border-border px-3 py-2 text-sm"
          aria-pressed={sort === "newest"}
          onClick={() => void chooseSort("newest")}
        >
          {t("newest")}
        </button>
        <button
          type="button"
          className="rounded-full border border-border px-3 py-2 text-sm"
          aria-pressed={sort === "oldest"}
          onClick={() => void chooseSort("oldest")}
        >
          {t("oldest")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-4 text-sm">
          {error}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="mt-6 text-foreground/80">{t("galleryEmpty")}</p>
      ) : (
        <div className="mt-6 columns-2 gap-3 sm:columns-3 lg:columns-4">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`mb-3 block w-full break-inside-avoid overflow-hidden rounded-2xl border border-border bg-card text-left ${item.isHidden ? "opacity-60" : ""}`}
              onClick={() => setOpenIndex(index)}
            >
              {item.previewUrl ? (
                // Signed storage URL; the image optimizer is not used.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="w-full object-cover" src={item.previewUrl} alt="" />
              ) : (
                <span className="flex h-32 items-center justify-center px-3 text-sm">
                  {item.type === "video" ? t("video") : item.originalFileName}
                </span>
              )}
              <span className="block px-3 py-2 text-sm">
                {item.guestName || item.originalFileName}
                {item.isHidden ? ` · ${t("hidden")}` : ""}
                {item.isFavorite ? ` · ${t("favorite")}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
      {current && openIndex !== null ? (
        <GalleryViewer
          items={items}
          index={openIndex}
          labels={{
            close: t("close"),
            previous: t("previous"),
            next: t("next"),
            download: t("download"),
            cannotPlay: t("cannotPlay"),
          }}
          onClose={() => setOpenIndex(null)}
          onIndex={setOpenIndex}
          onDownload={(id) => void download(id)}
          actions={
            <>
              <button
                type="button"
                className="rounded-full border border-white/40 px-3 py-2 text-sm"
                onClick={() =>
                  void mutate(current.id, current.isHidden ? "unhide" : "hide")
                }
              >
                {current.isHidden ? t("unhide") : t("hide")}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/40 px-3 py-2 text-sm"
                onClick={() =>
                  void mutate(current.id, current.isFavorite ? "unfavorite" : "favorite")
                }
              >
                {current.isFavorite ? t("unfavorite") : t("favorite")}
              </button>
              <button
                type="button"
                className="rounded-full border border-white/40 px-3 py-2 text-sm"
                onClick={() => void remove(current.id)}
              >
                {t("deleteMedia")}
              </button>
            </>
          }
        />
      ) : null}
    </section>
  );
}
