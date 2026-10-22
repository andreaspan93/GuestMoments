import { attachmentDisposition } from "@/lib/storage/disposition";
import { galleryErrorResponse, getCustomerMediaFile } from "@/lib/gallery/http";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; mediaId: string }> },
) {
  try {
    const { id, mediaId } = await context.params;
    const file = await getCustomerMediaFile(id, mediaId);

    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": attachmentDisposition(file.fileName),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return galleryErrorResponse(error);
  }
}
