import { galleryErrorResponse, galleryJson, postMediaAlbum } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await context.params;

    return galleryJson(await postMediaAlbum(id, mediaId, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
