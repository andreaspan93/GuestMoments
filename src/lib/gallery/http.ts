import { z } from "zod";
import { GalleryError, galleryStatus } from "@/lib/gallery/errors";
import {
  downloadCustomerMedia,
  downloadGuestMedia,
  listCustomerGallery,
  listGuestGallery,
  mutateCustomerMedia,
} from "@/lib/gallery/service";
import { readGuestCookie } from "@/lib/uploads/http";
import { getRequestSession } from "@/lib/session";

const actionRequest = z.strictObject({
  action: z.enum(["hide", "unhide", "favorite", "unfavorite"]),
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
