import { describe, expect, it } from "vitest";
import {
  GUEST_UPLOAD_CLOSE_MS,
  GUEST_UPLOAD_CONCURRENCY,
  claimFileStart,
  claimUploadStart,
  filesStillPending,
  guestEventPath,
  mapWithConcurrency,
  transferPercent,
  uploadAttemptResult,
  uploadBatchSummary,
  uploadFinishPlan,
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

  it("closes the upload panel two seconds after every file succeeds", () => {
    expect(GUEST_UPLOAD_CLOSE_MS).toBe(2000);
    expect(uploadFinishPlan(["done"])).toEqual({ showSuccess: true, closeAfterMs: 2000 });
    expect(uploadFinishPlan(["done", "done", "done"])).toEqual({
      showSuccess: true,
      closeAfterMs: 2000,
    });
  });

  it("waits for the last concurrent upload before starting the close timer", () => {
    expect(uploadFinishPlan(["done", "uploading", "waiting"])).toEqual({
      showSuccess: false,
      closeAfterMs: null,
    });
    expect(uploadFinishPlan(["done", "done", "uploading"])).toEqual({
      showSuccess: false,
      closeAfterMs: null,
    });
    expect(uploadFinishPlan(["done", "done", "done"])).toEqual({
      showSuccess: true,
      closeAfterMs: 2000,
    });
  });

  it("keeps the panel open after a partial failure and closes only when the retry succeeds", () => {
    expect(uploadFinishPlan(["done", "error"])).toEqual({
      showSuccess: false,
      closeAfterMs: null,
    });
    expect(uploadFinishPlan(["error", "waiting"])).toEqual({
      showSuccess: false,
      closeAfterMs: null,
    });
    expect(uploadFinishPlan(["done", "done"])).toEqual({
      showSuccess: true,
      closeAfterMs: 2000,
    });
    expect(uploadFinishPlan([])).toEqual({ showSuccess: false, closeAfterMs: null });
  });

  it("uploads at most three files at once and keeps their results in order", async () => {
    expect(GUEST_UPLOAD_CONCURRENCY).toBe(3);
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], GUEST_UPLOAD_CONCURRENCY, async (value) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, value === 1 ? 40 : 10));
      active -= 1;

      return value * 10;
    });

    expect(maxActive).toBe(3);
    expect(results).toEqual([10, 20, 30, 40, 50]);
    await expect(mapWithConcurrency([], 3, async () => 1)).resolves.toEqual([]);
  });

  it("retries only files that are not already uploaded", () => {
    expect(filesStillPending(["done", "error", "done", "waiting"])).toEqual([1, 3]);
    const active = new Set(["b"]);

    expect(claimFileStart(active, "a", "done")).toBe(false);
    expect(claimFileStart(active, "b", "error")).toBe(false);
    expect(claimFileStart(active, "c", "uploading")).toBe(false);
    expect(claimFileStart(active, "d", "error")).toBe(true);
    expect(claimFileStart(new Set(), "e", "waiting")).toBe(true);
  });

  it("counts real transfer progress and keeps successful files after a partial failure", () => {
    expect(transferPercent(50, 200)).toBe(25);
    expect(transferPercent(0, 0)).toBeNull();
    const summary = uploadBatchSummary([
      { status: "done", progress: 100 },
      { status: "uploading", progress: 50 },
      { status: "error", progress: 0 },
      { status: "waiting", progress: 0 },
    ]);

    expect(summary.completed).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.total).toBe(4);
    expect(summary.ratio).toBeCloseTo(1.5 / 4);
    expect(summary.allSucceeded).toBe(false);
    expect(summary.settled).toBe(false);
    expect(
      uploadBatchSummary([
        { status: "done", progress: 100 },
        { status: "error", progress: 0 },
      ]).settled,
    ).toBe(true);
    expect(
      uploadBatchSummary([
        { status: "done", progress: 100 },
        { status: "done", progress: 100 },
      ]).allSucceeded,
    ).toBe(true);
  });
});
