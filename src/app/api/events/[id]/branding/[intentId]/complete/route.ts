import {
  postBrandingComplete,
  uploadErrorResponse,
  uploadJson,
} from "@/lib/uploads/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; intentId: string }> },
) {
  try {
    const { id, intentId } = await context.params;

    return uploadJson(await postBrandingComplete(id, intentId, request));
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
