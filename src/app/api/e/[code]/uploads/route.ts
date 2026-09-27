import { uploadErrorResponse, uploadJson, postGuestUpload } from "@/lib/uploads/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  try {
    const { code } = await context.params;

    return uploadJson(await postGuestUpload(code, request));
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
