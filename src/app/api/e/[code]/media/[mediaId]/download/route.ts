import { galleryErrorResponse, galleryJson, getGuestDownload } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string; mediaId: string }> },
) {
  try {
    const { code, mediaId } = await context.params;

    return galleryJson(await getGuestDownload(code, mediaId));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
