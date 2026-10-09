import { galleryErrorResponse, galleryJson, postBulkAlbum } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return galleryJson(await postBulkAlbum(id, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
