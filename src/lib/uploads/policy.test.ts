import { describe, expect, it } from "vitest";
import { DEFAULT_MAX_PHOTO_BYTES, DEFAULT_MAX_VIDEO_BYTES } from "@/lib/events/defaults";
import { storageSignature, storageSignatureMatches } from "@/lib/storage/signature";
import { createGuestToken } from "@/lib/uploads/token";
import {
  classifyUpload,
  exceedsUploadCap,
  guestTokenFromRequest,
  isGuestToken,
  keysMatch,
} from "@/lib/uploads/policy";

const caps = {
  photo: DEFAULT_MAX_PHOTO_BYTES,
  video: DEFAULT_MAX_VIDEO_BYTES,
};

describe("upload policy", () => {
  it("rejects a disallowed type and an oversize photo or video", () => {
    expect(classifyUpload("image/gif", "photo.gif")).toBeNull();
    expect(classifyUpload("image/heic", "photo.heic")).toBeNull();
    expect(classifyUpload("image/jpeg", "photo.jpg")).toBe("photo");
    expect(classifyUpload("video/quicktime", "clip.mov")).toBe("video");
    expect(exceedsUploadCap("photo", caps.photo + BigInt(1), caps)).toBe(true);
    expect(exceedsUploadCap("video", caps.video + BigInt(1), caps)).toBe(true);
    expect(exceedsUploadCap("photo", caps.photo, caps)).toBe(false);
  });

  it("ignores a guest token typed into the form body", () => {
    const cookieToken = createGuestToken();
    const bodyToken = createGuestToken();

    expect(isGuestToken(cookieToken)).toBe(true);
    expect(cookieToken).toHaveLength(43);
    expect(guestTokenFromRequest(cookieToken, bodyToken)).toBe(cookieToken);
    expect(guestTokenFromRequest(undefined, bodyToken)).toBeNull();
  });

  it("rejects a storage key that was not issued on the intent", () => {
    expect(keysMatch("events/a/originals/b", "events/other/originals/c")).toBe(false);
    expect(keysMatch("events/a/originals/b", undefined)).toBe(true);
  });

  it("locks the signed content type and content length", () => {
    const matching = storageSignature({
      method: "PUT",
      key: "events/11111111-1111-1111-1111-111111111111/originals/22222222-2222-2222-2222-222222222222",
      contentType: "image/jpeg",
      contentLength: "12",
      expiresAt: 1_800_000_000_000,
      secret: "test-secret",
    });
    const otherLength = storageSignature({
      method: "PUT",
      key: "events/11111111-1111-1111-1111-111111111111/originals/22222222-2222-2222-2222-222222222222",
      contentType: "image/jpeg",
      contentLength: "13",
      expiresAt: 1_800_000_000_000,
      secret: "test-secret",
    });
    const otherType = storageSignature({
      method: "PUT",
      key: "events/11111111-1111-1111-1111-111111111111/originals/22222222-2222-2222-2222-222222222222",
      contentType: "image/png",
      contentLength: "12",
      expiresAt: 1_800_000_000_000,
      secret: "test-secret",
    });

    expect(storageSignatureMatches(matching, matching)).toBe(true);
    expect(storageSignatureMatches(matching, otherLength)).toBe(false);
    expect(storageSignatureMatches(matching, otherType)).toBe(false);
  });
});
