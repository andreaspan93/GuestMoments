import { galleryErrorResponse, galleryJson, removeGuestUploads } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;

    return galleryJson(await removeGuestUploads(code));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
