import {
  deleteCustomerMediaAction,
  galleryErrorResponse,
  galleryJson,
  postCustomerMediaAction,
} from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await context.params;

    return galleryJson(await postCustomerMediaAction(id, mediaId, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await context.params;

    return galleryJson(await deleteCustomerMediaAction(id, mediaId));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
