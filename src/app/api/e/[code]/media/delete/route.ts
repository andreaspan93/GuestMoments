import { galleryErrorResponse, galleryJson, removeGuestSelection } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;

    return galleryJson(await removeGuestSelection(code, request));
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
