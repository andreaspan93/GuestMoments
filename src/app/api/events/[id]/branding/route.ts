import { postBranding, uploadErrorResponse, uploadJson } from "@/lib/uploads/http";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;

    return uploadJson(await postBranding(id, request));
  } catch (error) {
    return uploadErrorResponse(error);
  }
}
