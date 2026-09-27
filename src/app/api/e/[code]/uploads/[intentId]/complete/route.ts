import {
  postGuestComplete,
  uploadErrorResponse,
  uploadJson,
} from "@/lib/uploads/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string; intentId: string }> },
) {
  try {
    const { code, intentId } = await context.params;

    return uploadJson(await postGuestComplete(code, intentId, request));
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
