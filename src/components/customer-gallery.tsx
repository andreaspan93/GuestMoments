"use client";

import { useState } from "react";
import { zip } from "fflate";
import { Eye, EyeOff, FolderPlus, Heart, Pencil, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { GalleryViewer, ViewerIconButton } from "@/components/gallery-viewer";
import {
  FAVORITES_COLLECTION,
  matchesCollection,
  type AlbumSummary,
  type CustomerGalleryItem,
} from "@/lib/gallery/present";
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
  const [success, setSuccess] = useState("");
  const [albumMenu, setAlbumMenu] = useState<"bulk" | "viewer" | null>(null);
  const [bulkAlbumId, setBulkAlbumId] = useState("");

  function reportError(text = t("galleryFailed")) {
    setSuccess("");
    setError(text);
  }

  const visible = items.filter((item) => matchesCollection(item, albumFilter));
  const openIndex = visible.findIndex((item) => item.id === openId);
  const current = openIndex >= 0 ? visible[openIndex] : null;

  async function load(nextSort = sort) {
    const response = await fetch(`/api/events/${eventId}/gallery?sort=${nextSort}`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      reportError();
      return false;
    }

    const body = (await response.json()) as { items?: CustomerGalleryItem[] };

    if (body.items) {
      setItems(body.items);
      setError("");
    }

    return true;
  }

  async function loadAlbums() {
    const response = await fetch(`/api/events/${eventId}/albums`, {
      credentials: "same-origin",
    });

    if (!response.ok) {
      reportError();
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
      reportError();
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
      reportError();
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
      reportError();
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
      reportError();
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
      reportError();
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
      reportError();
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
      reportError();
      return;
    }

    if (await load()) {
      setSuccess(albumId ? t("photoAssigned") : "");
      setAlbumMenu(null);
    }
  }

  async function assignSelected() {
    if (!bulkAlbumId || selected.length === 0) {
      return;
    }

    const response = await fetch(`/api/events/${eventId}/media/assign-album`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mediaIds: selected, albumId: bulkAlbumId }),
    });

    if (!response.ok) {
      reportError();
      return;
    }

    if (await load()) {
      setSuccess(t("albumAssigned"));
      setAlbumMenu(null);
    }
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
            className={toolbarChip(albumFilter === FAVORITES_COLLECTION)}
            aria-pressed={albumFilter === FAVORITES_COLLECTION}
            onClick={() => setAlbumFilter(FAVORITES_COLLECTION)}
          >
            {t("favorites")}
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
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-foreground/80 hover:bg-muted"
                aria-label={t("renameAlbum")}
                title={t("renameAlbum")}
                onClick={() => {
                  setEditingId(album.id);
                  setEditingName(album.name);
                }}
              >
                <Pencil className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-primary hover:bg-muted"
                aria-label={t("deleteAlbum")}
                title={t("deleteAlbum")}
                onClick={() => void removeAlbum(album.id)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid min-w-0 grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            className={cn(toolbarChip(sort === "newest"), "w-full min-w-0 border-0 px-2")}
            aria-pressed={sort === "newest"}
            onClick={() => void chooseSort("newest")}
          >
            {t("newest")}
          </button>
          <button
            type="button"
            className={cn(toolbarChip(sort === "oldest"), "w-full min-w-0 border-0 px-2")}
            aria-pressed={sort === "oldest"}
            onClick={() => void chooseSort("oldest")}
          >
            {t("oldest")}
          </button>
        </div>
        <button
          type="button"
          className={cn(
            "h-10 min-w-0 rounded-full px-3 text-center text-sm font-medium break-words",
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
      {selected.length > 0 ? (
        <div className="grid gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-fit max-w-full items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium"
            aria-expanded={albumMenu === "bulk"}
            onClick={() => setAlbumMenu((current) => (current === "bulk" ? null : "bulk"))}
          >
            <FolderPlus className="size-4" aria-hidden="true" />
            {t("addToAlbum")}
          </button>
          {albumMenu === "bulk" ? (
            albums.length === 0 ? (
              <p className="text-sm text-foreground/80">{t("noAlbumsYet")}</p>
            ) : (
              <form
                className="flex flex-col gap-2 sm:flex-row sm:items-center"
                onSubmit={(event) => {
                  event.preventDefault();
                  void assignSelected();
                }}
              >
                <label className="grid min-w-0 flex-1 gap-1 text-sm font-medium">
                  {t("album")}
                  <select
                    className="h-10 w-full rounded-full border border-border bg-background px-3 text-sm"
                    value={bulkAlbumId}
                    onChange={(event) => setBulkAlbumId(event.target.value)}
                  >
                    <option value="">{t("addToAlbum")}</option>
                    {albums.map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  className="h-10 shrink-0 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
                  disabled={!bulkAlbumId}
                >
                  {t("applyAlbum")}
                </button>
              </form>
            )
          ) : null}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-foreground/80">
          {success}
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
              <div className="relative">
                <ViewerIconButton
                  label={t("addToAlbum")}
                  pressed={albumMenu === "viewer"}
                  onClick={() => setAlbumMenu((currentMenu) => (currentMenu === "viewer" ? null : "viewer"))}
                >
                  <FolderPlus className="size-5" aria-hidden="true" />
                </ViewerIconButton>
                {albumMenu === "viewer" ? (
                  <div className="absolute bottom-12 left-1/2 z-10 w-56 -translate-x-1/2 rounded-2xl bg-white p-3 text-left text-sm text-black shadow-lg">
                    {albums.length === 0 ? (
                      <p>{t("noAlbumsYet")}</p>
                    ) : (
                      <label className="grid gap-1 font-medium">
                        {t("addToAlbum")}
                        <select
                          className="h-10 w-full rounded-full border border-border bg-white px-3 text-sm"
                          value={current.albumId ?? ""}
                          aria-label={t("addToAlbum")}
                          onChange={(event) =>
                            void assignAlbum(current.id, event.target.value || null)
                          }
                        >
                          <option value="">{t("noAlbum")}</option>
                          {albums.map((album) => (
                            <option key={album.id} value={album.id}>
                              {album.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                ) : null}
              </div>
              <ViewerIconButton
                label={current.isHidden ? t("unhide") : t("hide")}
                pressed={current.isHidden}
                onClick={() => void mutate(current.id, current.isHidden ? "unhide" : "hide")}
              >
                {current.isHidden ? (
                  <EyeOff className="size-5" aria-hidden="true" />
                ) : (
                  <Eye className="size-5" aria-hidden="true" />
                )}
              </ViewerIconButton>
              <ViewerIconButton
                label={current.isFavorite ? t("unfavorite") : t("favorite")}
                pressed={current.isFavorite}
                onClick={() =>
                  void mutate(current.id, current.isFavorite ? "unfavorite" : "favorite")
                }
              >
                <Heart
                  className={cn("size-5", current.isFavorite && "fill-current")}
                  aria-hidden="true"
                />
              </ViewerIconButton>
              <ViewerIconButton
                label={t("deleteMedia")}
                destructive
                onClick={() => void remove(current.id)}
              >
                <Trash2 className="size-5" aria-hidden="true" />
              </ViewerIconButton>
            </>
          }
        />
      ) : null}
    </section>
  );
}
