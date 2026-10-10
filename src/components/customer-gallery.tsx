"use client";

import { useEffect, useId, useRef, useState } from "react";
import { zip } from "fflate";
import { Ellipsis, Eye, EyeOff, FolderPlus, Heart, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { GalleryViewer, ViewerIconButton } from "@/components/gallery-viewer";
import {
  FAVORITES_COLLECTION,
  matchesCollection,
  type AlbumSummary,
  type CustomerGalleryItem,
} from "@/lib/gallery/present";
import { cn } from "@/lib/utils";

const controlClass =
  "h-10 min-w-0 rounded-full border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60";

const primaryClass =
  "inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60";

function sortChip(selected: boolean) {
  return cn(
    "inline-flex h-full min-w-0 items-center justify-center truncate rounded-full px-2 text-xs font-medium sm:px-3 sm:text-sm",
    selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
  );
}

export function CustomerGallery({
  eventId,
  eventName,
  initialItems,
  initialAlbums,
}: {
  eventId: string;
  eventName: string;
  initialItems: CustomerGalleryItem[];
  initialAlbums: AlbumSummary[];
}) {
  const t = useTranslations("events");
  const albumNameId = useId();
  const albumErrorId = useId();
  const albumInputRef = useRef<HTMLInputElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState(initialItems);
  const [albums, setAlbums] = useState(initialAlbums);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [albumFilter, setAlbumFilter] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [albumName, setAlbumName] = useState("");
  const [albumPending, setAlbumPending] = useState(false);
  const [albumError, setAlbumError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [renamePending, setRenamePending] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
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
  const activeAlbum = albums.find((album) => album.id === albumFilter) ?? null;
  const collectionFilter =
    albumFilter === "all" || albumFilter === FAVORITES_COLLECTION || albumFilter === "none"
      ? albumFilter
      : "";

  useEffect(() => {
    if (creatingAlbum) {
      albumInputRef.current?.focus();
    }
  }, [creatingAlbum]);

  useEffect(() => {
    if (!actionsOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!actionsRef.current?.contains(event.target as Node)) {
        setActionsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [actionsOpen]);

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

  function rememberAlbum(album: AlbumSummary) {
    setAlbums((currentAlbums) =>
      [...currentAlbums.filter((entry) => entry.id !== album.id), album].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    );
  }

  function cancelCreate() {
    if (albumPending) {
      return;
    }

    setCreatingAlbum(false);
    setAlbumName("");
    setAlbumError("");
  }

  function cancelRename() {
    if (renamePending) {
      return;
    }

    setEditingId(null);
    setEditingName("");
  }

  async function createAlbum(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (albumPending) {
      return;
    }

    const name = albumName.trim();

    if (!name) {
      setAlbumError(t("albumNameRequired"));
      albumInputRef.current?.focus();
      return;
    }

    setAlbumPending(true);
    setAlbumError("");

    try {
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

      const created = (await response.json().catch(() => null)) as { id?: string; name?: string } | null;

      if (created?.id && created.name) {
        rememberAlbum({ id: created.id, name: created.name });
      } else {
        await loadAlbums();
      }

      setAlbumName("");
      setCreatingAlbum(false);
      setError("");
    } finally {
      setAlbumPending(false);
    }
  }

  async function renameAlbum(albumId: string) {
    if (renamePending) {
      return;
    }

    const name = editingName.trim();

    if (!name) {
      setError(t("albumNameRequired"));
      return;
    }

    setRenamePending(true);

    try {
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

      const renamed = (await response.json().catch(() => null)) as { id?: string; name?: string } | null;

      if (renamed?.id && renamed.name) {
        rememberAlbum({ id: renamed.id, name: renamed.name });
      } else {
        await loadAlbums();
      }

      setEditingId(null);
      setError("");
    } finally {
      setRenamePending(false);
    }
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
    <>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="min-w-0 truncate text-3xl font-semibold tracking-tight" title={eventName}>
            {eventName}
          </h1>
          <button
            type="button"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("createAlbum")}
            title={t("createAlbum")}
            aria-expanded={creatingAlbum}
            onClick={() => {
              setCreatingAlbum(true);
              setActionsOpen(false);
              setEditingId(null);
              setAlbumError("");
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <p className="mt-2 text-sm text-foreground/80">{t("galleryTitle")}</p>
      </div>
      <section className="grid min-w-0 gap-4">
      <div className="grid min-w-0 gap-2">
        {creatingAlbum ? (
          <form
            className="grid min-w-0 gap-2"
            onSubmit={(event) => void createAlbum(event)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelCreate();
              }
            }}
          >
            <label className="grid min-w-0 gap-1 text-sm font-medium" htmlFor={albumNameId}>
              {t("albumName")}
              <input
                ref={albumInputRef}
                id={albumNameId}
                className={controlClass}
                value={albumName}
                maxLength={80}
                disabled={albumPending}
                aria-invalid={albumError ? true : undefined}
                aria-describedby={albumError ? albumErrorId : undefined}
                onChange={(event) => {
                  setAlbumName(event.target.value);
                  setAlbumError("");
                }}
              />
            </label>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <button type="submit" className={primaryClass} disabled={albumPending} aria-busy={albumPending}>
                {albumPending ? t("pending") : t("add")}
              </button>
              <button
                type="button"
                className={cn(controlClass, "bg-card px-4")}
                disabled={albumPending}
                onClick={cancelCreate}
              >
                {t("cancel")}
              </button>
            </div>
            {albumError ? (
              <p id={albumErrorId} role="alert" className="text-sm">
                {albumError}
              </p>
            ) : null}
          </form>
        ) : null}
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          <div className="grid min-w-0 gap-2">
            <div className="grid min-w-0 gap-1">
              <span className="text-sm font-medium">{t("albums")}</span>
              <div className="flex min-w-0 gap-2">
                <select
                  className={cn(controlClass, "w-full min-w-0 flex-1")}
                  aria-label={t("albums")}
                  value={activeAlbum?.id ?? ""}
                  onChange={(event) => {
                    setAlbumFilter(event.target.value || "all");
                    setActionsOpen(false);
                    setEditingId(null);
                  }}
                >
                  <option value="">{t("albums")}</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name}
                    </option>
                  ))}
                </select>
                <div ref={actionsRef} className="relative shrink-0">
                  <button
                    type="button"
                    className="inline-flex size-10 items-center justify-center rounded-full border border-border bg-card text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={t("albumActions")}
                    title={t("albumActions")}
                    aria-haspopup="menu"
                    aria-expanded={actionsOpen}
                    disabled={!activeAlbum}
                    onClick={() => setActionsOpen((open) => !open)}
                  >
                    <Ellipsis className="size-4" aria-hidden="true" />
                  </button>
                  {actionsOpen && activeAlbum ? (
                    <div
                      role="menu"
                      className="absolute right-0 z-20 mt-1 w-48 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-1 shadow-sm"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        className="flex h-10 w-full items-center rounded-xl px-3 text-left text-sm hover:bg-muted"
                        onClick={() => {
                          setEditingId(activeAlbum.id);
                          setEditingName(activeAlbum.name);
                          setActionsOpen(false);
                        }}
                      >
                        {t("renameAlbum")}
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex h-10 w-full items-center rounded-xl px-3 text-left text-sm text-primary hover:bg-muted"
                        onClick={() => {
                          setActionsOpen(false);
                          void removeAlbum(activeAlbum.id);
                        }}
                      >
                        {t("deleteAlbum")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            {editingId && activeAlbum && editingId === activeAlbum.id ? (
              <form
                className="grid gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void renameAlbum(activeAlbum.id);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
              >
                <input
                  className={controlClass}
                  value={editingName}
                  maxLength={80}
                  disabled={renamePending}
                  autoFocus
                  aria-label={t("renameAlbum")}
                  onChange={(event) => setEditingName(event.target.value)}
                />
                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button type="submit" className={primaryClass} disabled={renamePending} aria-busy={renamePending}>
                    {renamePending ? t("pending") : t("save")}
                  </button>
                  <button
                    type="button"
                    className={cn(controlClass, "bg-card px-4")}
                    disabled={renamePending}
                    onClick={cancelRename}
                  >
                    {t("cancel")}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
          <label className="grid min-w-0 gap-1 text-sm font-medium">
            {t("filter")}
            <select
              className={controlClass}
              value={collectionFilter}
              onChange={(event) => {
                const value = event.target.value;

                if (value === "all" || value === FAVORITES_COLLECTION || value === "none") {
                  setAlbumFilter(value);
                  setActionsOpen(false);
                  setEditingId(null);
                }
              }}
            >
              {collectionFilter === "" ? <option value="">{t("filter")}</option> : null}
              <option value="all">{t("allAlbums")}</option>
              <option value={FAVORITES_COLLECTION}>{t("favorites")}</option>
              <option value="none">{t("unassigned")}</option>
            </select>
          </label>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid h-10 min-w-0 grid-cols-2 gap-1 rounded-full border border-border bg-card p-1">
          <button
            type="button"
            className={sortChip(sort === "newest")}
            aria-pressed={sort === "newest"}
            onClick={() => void chooseSort("newest")}
          >
            {t("newest")}
          </button>
          <button
            type="button"
            className={sortChip(sort === "oldest")}
            aria-pressed={sort === "oldest"}
            onClick={() => void chooseSort("oldest")}
          >
            {t("oldest")}
          </button>
        </div>
        {selected.length > 0 ? (
          <button
            type="button"
            className="h-10 min-w-0 truncate rounded-full bg-primary px-3 text-sm font-medium whitespace-nowrap text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            title={zipping ? t("bulkPending") : t("bulkDownload")}
            disabled={zipping}
            aria-busy={zipping}
            onClick={() => void downloadSelection()}
          >
            {zipping ? t("bulkPending") : t("bulkDownload")}
          </button>
        ) : null}
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
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {visible.map((item) => {
            const album = albums.find((entry) => entry.id === item.albumId);
            const isSelected = selected.includes(item.id);
            const caption = [
              item.guestName || item.originalFileName,
              album?.name,
              item.isHidden ? t("hidden") : "",
              item.isFavorite ? t("favorite") : "",
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <li
                key={item.id}
                className={cn(
                  "relative min-w-0 overflow-hidden rounded-2xl border bg-card",
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
                        {item.type === "video" ? t("video") : item.originalFileName}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 block h-12 overflow-hidden px-2 py-1.5 text-xs leading-4 sm:h-14 sm:px-3 sm:py-2 sm:text-sm sm:leading-5" title={caption}>
                    {caption}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
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
    </>
  );
}
