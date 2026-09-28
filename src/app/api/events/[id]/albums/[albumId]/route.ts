import {
  galleryErrorResponse,
  galleryJson,
  patchCustomerAlbum,
  removeCustomerAlbum,
} from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; albumId: string }> },
) {
  try {
    const { id, albumId } = await context.params;

    return galleryJson(await patchCustomerAlbum(id, albumId, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; albumId: string }> },
) {
  try {
    const { id, albumId } = await context.params;

    return galleryJson(await removeCustomerAlbum(id, albumId));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
