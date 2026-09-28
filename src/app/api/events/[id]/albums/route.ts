import {
  galleryErrorResponse,
  galleryJson,
  getCustomerAlbums,
  postCustomerAlbum,
} from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return galleryJson(await getCustomerAlbums(id));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return galleryJson(await postCustomerAlbum(id, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
