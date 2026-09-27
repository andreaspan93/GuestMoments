import { describe, expect, it } from "vitest";
import { createR2Storage } from "@/lib/storage/r2";

describe("R2 presign", () => {
  it("signs content type and content length", async () => {
    const storage = createR2Storage({
      accountId: "exampleaccount",
      accessKeyId: "test-access-key",
      secretAccessKey: "test-secret-key",
      bucket: "guestmoments-test",
    });
    const presigned = await storage.presignPut({
      key: "events/11111111-1111-4111-8111-111111111111/originals/22222222-2222-4222-8222-222222222222",
      contentType: "image/jpeg",
      contentLength: 128,
      expiresInSeconds: 60,
    });
    const signedHeaders = new URL(presigned.url).searchParams.get("X-Amz-SignedHeaders");

    expect(presigned.headers["Content-Type"]).toBe("image/jpeg");
    expect(signedHeaders).toContain("content-type");
    expect(signedHeaders).toContain("content-length");
  });
});
