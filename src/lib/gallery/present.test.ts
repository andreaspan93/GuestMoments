import { describe, expect, it } from "vitest";
import {
  exceedsBulkCap,
  FAVORITES_COLLECTION,
  formatStorage,
  matchesCollection,
  uniqueZipNames,
  BULK_DOWNLOAD_MAX_BYTES,
} from "@/lib/gallery/present";
import { attachmentDisposition } from "@/lib/storage/disposition";
import { storageSignature } from "@/lib/storage/signature";

describe("gallery presentation", () => {
  it("formats storage in megabytes", () => {
    expect(formatStorage(BigInt(0))).toBe("0 MB");
    expect(formatStorage(BigInt(1024) * BigInt(1024))).toBe("1 MB");
    expect(formatStorage(BigInt(150) * BigInt(1024) * BigInt(1024))).toBe("150 MB");
  });

  it("locks a sanitized download name into the signature", () => {
    const base = {
      method: "GET" as const,
      key: "events/11111111-1111-1111-1111-111111111111/originals/22222222-2222-2222-2222-222222222222",
      contentType: "",
      contentLength: "",
      expiresAt: 1_800_000_000_000,
      secret: "test-secret",
    };
    const named = storageSignature({ ...base, downloadName: "photo.jpg" });
    const other = storageSignature({ ...base, downloadName: "other.jpg" });
    const plain = storageSignature(base);

    expect(named).not.toBe(other);
    expect(named).not.toBe(plain);
    expect(attachmentDisposition("../secret.jpg")).toContain('filename="secret.jpg"');
  });

  it("treats favorites as a collection beside album membership", () => {
    const favorite = { albumId: "album-1", isFavorite: true };
    const plain = { albumId: null, isFavorite: false };

    expect(matchesCollection(favorite, "all")).toBe(true);
    expect(matchesCollection(favorite, FAVORITES_COLLECTION)).toBe(true);
    expect(matchesCollection(plain, FAVORITES_COLLECTION)).toBe(false);
    expect(matchesCollection(favorite, "album-1")).toBe(true);
    expect(matchesCollection(plain, "none")).toBe(true);
    expect(matchesCollection(favorite, "none")).toBe(false);
  });

  it("keeps zip names unique and rejects a selection over 200 MB", () => {
    expect(uniqueZipNames(["../a.jpg", "a.jpg", "note"])).toEqual(["a.jpg", "a (2).jpg", "note"]);
    expect(exceedsBulkCap(BULK_DOWNLOAD_MAX_BYTES)).toBe(false);
    expect(exceedsBulkCap(BULK_DOWNLOAD_MAX_BYTES + BigInt(1))).toBe(true);
  });
});
