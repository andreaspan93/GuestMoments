import { z } from "zod";
import { GalleryError, galleryStatus } from "@/lib/gallery/errors";
import {
  assignCustomerMediaAlbum,
  createCustomerAlbum,
  deleteCustomerAlbum,
  downloadCustomerMedia,
  downloadGuestMedia,
  listCustomerAlbums,
  listCustomerGallery,
  listGuestGallery,
  mutateCustomerMedia,
  prepareBulkDownload,
  renameCustomerAlbum,
} from "@/lib/gallery/service";
import { readGuestCookie } from "@/lib/uploads/http";
import { getRequestSession } from "@/lib/session";

const actionRequest = z.strictObject({
  action: z.enum(["hide", "unhide", "favorite", "unfavorite"]),
});

const albumNameRequest = z.strictObject({
  name: z.string().trim().min(1).max(80),
});

const assignAlbumRequest = z.strictObject({
  albumId: z.string().uuid().nullable(),
});

const bulkDownloadRequest = z.strictObject({
  mediaIds: z.array(z.string().uuid()).min(1).max(500),
});

export function galleryJson(body: unknown, status = 200) {
  return Response.json(body, { status });
}

export function galleryErrorResponse(error: unknown) {
  if (error instanceof GalleryError) {
    return galleryJson({ error: error.code }, galleryStatus(error.code));
  }

  if (error instanceof z.ZodError) {
    return galleryJson({ error: "notFound" }, 400);
  }

  throw error;
}

function gallerySort(request: Request) {
  const sort = new URL(request.url).searchParams.get("sort");

  return sort === "oldest" ? "oldest" : "newest";
}

export async function getGuestGallery(code: string) {
  return {
    items: await listGuestGallery(code, await readGuestCookie(code)),
  };
}

export async function getGuestDownload(code: string, mediaId: string) {
  return downloadGuestMedia(code, mediaId, await readGuestCookie(code));
}

export async function getCustomerGallery(eventId: string, request: Request) {
  const session = await getRequestSession();

  if (!session) {
    throw new GalleryError("unauthorized");
  }

  return {
    items: await listCustomerGallery(session.user, eventId, gallerySort(request)),
  };
}

export async function getCustomerDownload(eventId: string, mediaId: string) {
  const session = await getRequestSession();

  return downloadCustomerMedia(session?.user ?? null, eventId, mediaId);
}

export async function postCustomerMediaAction(
  eventId: string,
  mediaId: string,
  request: Request,
) {
  const session = await getRequestSession();
  const body = actionRequest.parse(await request.json().catch(() => null));

  return mutateCustomerMedia(session?.user ?? null, eventId, mediaId, body.action);
}

export async function deleteCustomerMediaAction(eventId: string, mediaId: string) {
  const session = await getRequestSession();

  return mutateCustomerMedia(session?.user ?? null, eventId, mediaId, "delete");
}

async function customerActor() {
  const session = await getRequestSession();

  return session?.user ?? null;
}

export async function getCustomerAlbums(eventId: string) {
  const actor = await customerActor();

  if (!actor) {
    throw new GalleryError("unauthorized");
  }

  return { albums: await listCustomerAlbums(actor, eventId) };
}

export async function postCustomerAlbum(eventId: string, request: Request) {
  const body = albumNameRequest.parse(await request.json().catch(() => null));

  return createCustomerAlbum(await customerActor(), eventId, body.name);
}

export async function patchCustomerAlbum(eventId: string, albumId: string, request: Request) {
  const body = albumNameRequest.parse(await request.json().catch(() => null));

  return renameCustomerAlbum(await customerActor(), eventId, albumId, body.name);
}

export async function removeCustomerAlbum(eventId: string, albumId: string) {
  return deleteCustomerAlbum(await customerActor(), eventId, albumId);
}

export async function postMediaAlbum(eventId: string, mediaId: string, request: Request) {
  const body = assignAlbumRequest.parse(await request.json().catch(() => null));

  return assignCustomerMediaAlbum(await customerActor(), eventId, mediaId, body.albumId);
}

export async function postBulkDownload(eventId: string, request: Request) {
  const body = bulkDownloadRequest.parse(await request.json().catch(() => null));

  return prepareBulkDownload(await customerActor(), eventId, body.mediaIds);
}
