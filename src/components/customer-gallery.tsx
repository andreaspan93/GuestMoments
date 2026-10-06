"use client";

import { useState } from "react";
import { zip } from "fflate";
import { useTranslations } from "next-intl";
import { GalleryViewer } from "@/components/gallery-viewer";
import type { AlbumSummary, CustomerGalleryItem } from "@/lib/gallery/present";
import { cn } from "@/lib/utils";

function toolbarChip(selected: boolean) {
  return cn(
    "inline-flex h-10 max-w-full items-center justify-center truncate rounded-full px-3 text-sm font-medium",
    selected
      ? "bg-primary text-primary-foreground"
      : "border border-border bg-card text-foreground hover:bg-muted",
  );
}

export function CustomerGallery({
  eventId,
  initialItems,
  initialAlbums,
}: {
  eventId: string;
  initialItems: CustomerGalleryItem[];
  initialAlbums: AlbumSummary[];
}) {
  const t = useTranslations("events");
  const [items, setItems] = useState(initialItems);
  const [albums, setAlbums] = useState(initialAlbums);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [albumFilter, setAlbumFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [albumName, setAlbumName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [zipping, setZipping] = useState(false);
  const [error, setError] = useState("");

  const visible = items.filter((item) => {
    if (albumFilter === "all") {
      return true;
    }

    if (albumFilter === "none") {
      return item.albumId === null;
    }

    return item.albumId === albumFilter;
  });
  const openIndex = visible.findIndex((item) => item.id === openId);
  const current = openIndex >= 0 ? visible[openIndex] : null;

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

  async function loadAlbums() {
    const response = await fetch(`/api/events/${eventId}/albums`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    const body = (await response.json()) as { albums?: AlbumSummary[] };

    if (body.albums) {
      setAlbums(body.albums);
    }
  }

  async function chooseSort(next: "newest" | "oldest") {
    setSort(next);
    setOpenId(null);
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

    setOpenId(null);
    setSelected((currentIds) => currentIds.filter((itemId) => itemId !== id));
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

  async function createAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = albumName.trim();

    if (!name) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/albums`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    setAlbumName("");
    await loadAlbums();
  }

  async function renameAlbum(albumId: string) {
    const name = editingName.trim();

    if (!name) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/albums/${albumId}`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    setEditingId(null);
    await loadAlbums();
  }

  async function removeAlbum(albumId: string) {
    if (!window.confirm(t("deleteAlbumConfirm"))) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/albums/${albumId}`, {
      method: "DELETE",
      credentials: "same-origin",
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    if (albumFilter === albumId) {
      setAlbumFilter("all");
    }

    setEditingId(null);
    await Promise.all([loadAlbums(), load()]);
  }

  async function assignAlbum(mediaId: string, albumId: string | null) {
    const response = await fetch(`/api/events/${eventId}/media/${mediaId}/album`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ albumId }),
    });

    if (!response.ok) {
      setError(t("galleryFailed"));
      return;
    }

    await load();
  }

  function toggleSelected(id: string) {
    setSelected((currentIds) =>
      currentIds.includes(id) ? currentIds.filter((itemId) => itemId !== id) : [...currentIds, id],
    );
  }

  async function downloadSelection() {
    if (selected.length === 0 || zipping) {
      return;
    }

    setZipping(true);
    setError("");
    const response = await fetch(`/api/events/${eventId}/downloads`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds: selected }),
    });

    if (response.status === 413) {
      setZipping(false);
      setError(t("bulkTooLarge"));
      return;
    }

    if (!response.ok) {
      setZipping(false);
      setError(t("galleryFailed"));
      return;
    }

    const body = (await response.json()) as { files?: { name: string; url: string }[] };

    if (!body.files?.length) {
      setZipping(false);
      return;
    }

    try {
      const entries: Record<string, Uint8Array> = {};

      for (const file of body.files) {
        const bytes = await fetch(file.url);
        entries[file.name] = new Uint8Array(await bytes.arrayBuffer());
      }

      const zipped = await new Promise<Uint8Array>((resolve, reject) => {
        zip(entries, (zipError, data) => {
          if (zipError || !data) {
            reject(zipError ?? new Error("zip"));
            return;
          }

          resolve(data);
        });
      });
      const blob = new Blob([zipped.buffer as ArrayBuffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "moments.zip";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError(t("galleryFailed"));
    } finally {
      setZipping(false);
    }
  }

  return (
    <section className="grid gap-4">
      <div className="grid gap-3">
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(event) => void createAlbum(event)}
        >
          <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium" htmlFor="album-name">
            {t("albums")}
            <input
              id="album-name"
              className="h-10 w-full min-w-0 rounded-full border border-border bg-background px-4 text-sm"
              value={albumName}
              maxLength={80}
              onChange={(event) => setAlbumName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {t("createAlbum")}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={toolbarChip(albumFilter === "all")}
            aria-pressed={albumFilter === "all"}
            onClick={() => setAlbumFilter("all")}
          >
            {t("allAlbums")}
          </button>
          <button
            type="button"
            className={toolbarChip(albumFilter === "none")}
            aria-pressed={albumFilter === "none"}
            onClick={() => setAlbumFilter("none")}
          >
            {t("unassigned")}
          </button>
          {albums.map((album) => (
            <span
              key={album.id}
              className="flex max-w-full flex-wrap items-center gap-1 rounded-2xl border border-border bg-card p-1"
            >
              {editingId === album.id ? (
                <form
                  className="flex min-w-0 flex-1 flex-wrap gap-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void renameAlbum(album.id);
                  }}
                >
                  <input
                    className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-3 text-sm"
                    value={editingName}
                    maxLength={80}
                    aria-label={t("renameAlbum")}
                    onChange={(event) => setEditingName(event.target.value)}
                  />
                  <button
                    type="submit"
                    className="h-10 shrink-0 rounded-full bg-primary px-3 text-sm font-medium text-primary-foreground"
                  >
                    {t("save")}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className={cn(toolbarChip(albumFilter === album.id), "min-w-0 flex-1 border-0")}
                  aria-pressed={albumFilter === album.id}
                  onClick={() => setAlbumFilter(album.id)}
                >
                  {album.name}
                </button>
              )}
              <button
                type="button"
                className="h-10 shrink-0 rounded-full px-3 text-sm text-foreground/80 hover:bg-muted"
                onClick={() => {
                  setEditingId(album.id);
                  setEditingName(album.name);
                }}
              >
                {t("renameAlbum")}
              </button>
              <button
                type="button"
                className="h-10 shrink-0 rounded-full px-3 text-sm text-foreground/80 hover:bg-muted"
                onClick={() => void removeAlbum(album.id)}
              >
                {t("deleteAlbum")}
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border bg-card p-1 sm:inline-grid sm:w-auto">
          <button
            type="button"
            className={cn(toolbarChip(sort === "newest"), "w-full border-0")}
            aria-pressed={sort === "newest"}
            onClick={() => void chooseSort("newest")}
          >
            {t("newest")}
          </button>
          <button
            type="button"
            className={cn(toolbarChip(sort === "oldest"), "w-full border-0")}
            aria-pressed={sort === "oldest"}
            onClick={() => void chooseSort("oldest")}
          >
            {t("oldest")}
          </button>
        </div>
        <button
          type="button"
          className={cn(
            "h-10 w-full rounded-full px-4 text-sm font-medium sm:w-auto",
            selected.length > 0
              ? "bg-primary text-primary-foreground"
              : "border border-border bg-card text-foreground/55",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
          disabled={selected.length === 0 || zipping}
          onClick={() => void downloadSelection()}
        >
          {zipping ? t("bulkPending") : t("bulkDownload")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-foreground/80">
          {items.length === 0 ? t("galleryEmpty") : t("albumEmpty")}
        </p>
      ) : (
        <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
          {visible.map((item) => {
            const album = albums.find((entry) => entry.id === item.albumId);
            const isSelected = selected.includes(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  "relative mb-3 break-inside-avoid overflow-hidden rounded-2xl border bg-card",
                  isSelected ? "border-primary ring-2 ring-primary" : "border-border",
                  item.isHidden && "opacity-60",
                )}
              >
                {isSelected ? (
                  <span className="pointer-events-none absolute inset-0 z-[1] bg-primary/15" />
                ) : null}
                <label className="absolute top-2 left-2 z-10">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={isSelected}
                    aria-label={t("select")}
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
                <button type="button" className="block w-full text-left" onClick={() => setOpenId(item.id)}>
                  {item.previewUrl ? (
                    // Signed storage URL; the image optimizer is not used.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="min-h-32 w-full object-cover" src={item.previewUrl} alt="" />
                  ) : (
                    <span className="flex h-32 items-center justify-center px-3 text-center text-sm break-words">
                      {item.type === "video" ? t("video") : item.originalFileName}
                    </span>
                  )}
                  <span className="block px-3 py-2 text-sm break-words">
                    {item.guestName || item.originalFileName}
                    {album ? ` · ${album.name}` : ""}
                    {item.isHidden ? ` · ${t("hidden")}` : ""}
                    {item.isFavorite ? ` · ${t("favorite")}` : ""}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {current && openIndex >= 0 ? (
        <GalleryViewer
          items={visible}
          index={openIndex}
          labels={{
            close: t("close"),
            previous: t("previous"),
            next: t("next"),
            download: t("download"),
            cannotPlay: t("cannotPlay"),
          }}
          onClose={() => setOpenId(null)}
          onIndex={(index) => setOpenId(visible[index]?.id ?? null)}
          onDownload={(id) => void download(id)}
          actions={
            <>
              <label className="inline-flex items-center gap-2 text-sm">
                {t("album")}
                <select
                  className="h-9 rounded-full bg-white px-3 text-sm text-black"
                  value={current.albumId ?? ""}
                  onChange={(event) => void assignAlbum(current.id, event.target.value || null)}
                >
                  <option value="">{t("noAlbum")}</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="rounded-full border border-white/40 px-3 py-2 text-sm"
                onClick={() => void mutate(current.id, current.isHidden ? "unhide" : "hide")}
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
