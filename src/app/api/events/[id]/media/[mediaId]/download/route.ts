import {
  galleryErrorResponse,
  galleryJson,
  getCustomerDownload,
} from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await context.params;

    return galleryJson(await getCustomerDownload(id, mediaId));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
