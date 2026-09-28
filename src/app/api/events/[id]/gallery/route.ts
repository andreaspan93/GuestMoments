import {
  galleryErrorResponse,
  galleryJson,
  getCustomerGallery,
} from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return galleryJson(await getCustomerGallery(id, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
