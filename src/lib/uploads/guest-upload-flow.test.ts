import { describe, expect, it } from "vitest";
import {
  claimUploadStart,
  guestEventPath,
  uploadAttemptResult,
} from "@/lib/uploads/guest-upload-flow";

describe("guest upload finish", () => {
  it("resets and redirects only after every file succeeds", () => {
    expect(uploadAttemptResult(["done", "done"])).toEqual({
      succeeded: true,
      reset: true,
      redirect: true,
    });
  });

  it("stays on the page and keeps the selection when any file fails", () => {
    expect(uploadAttemptResult(["done", "error"])).toEqual({
      succeeded: false,
      reset: false,
      redirect: false,
    });
    expect(uploadAttemptResult(["error"])).toEqual({
      succeeded: false,
      reset: false,
      redirect: false,
    });
  });

  it("does not treat an empty submission as a successful upload", () => {
    expect(uploadAttemptResult([])).toEqual({
      succeeded: false,
      reset: false,
      redirect: false,
    });
  });

  it("ignores a second submit while an upload is in progress", () => {
    expect(claimUploadStart(false)).toBe(true);
    expect(claimUploadStart(true)).toBe(false);
  });

  it("returns the guest to the same event page", () => {
    expect(guestEventPath("abc_DEF-123")).toBe("/e/abc_DEF-123");
  });
});
