import { galleryErrorResponse, galleryJson, postBulkDelete } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return galleryJson(await postBulkDelete(id, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
