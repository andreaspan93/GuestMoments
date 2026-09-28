import { galleryErrorResponse, galleryJson, getGuestGallery } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;

    return galleryJson(await getGuestGallery(code));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
