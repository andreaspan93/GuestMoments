import { galleryErrorResponse, galleryJson, removeGuestMedia } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ code: string; mediaId: string }> },
) {
  try {
    const { code, mediaId } = await context.params;

    return galleryJson(await removeGuestMedia(code, mediaId));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
