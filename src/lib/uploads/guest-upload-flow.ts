export const GUEST_UPLOAD_CLOSE_MS = 2000;

/** Three overlaps the transfers without decoding an unlimited set of photos on a phone. */
export const GUEST_UPLOAD_CONCURRENCY = 3;

export type UploadStatus = "ready" | "waiting" | "uploading" | "done" | "error";

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let cursor = 0;
  const lanes = Math.max(1, Math.min(limit, items.length));

  async function lane() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index] as T, index);
    }
  }

  await Promise.all(Array.from({ length: lanes }, () => lane()));

  return results;
}

export function filesStillPending(statuses: readonly UploadStatus[]) {
  return statuses.flatMap((status, index) => (status === "done" ? [] : [index]));
}

export function claimFileStart(active: ReadonlySet<string>, id: string, status: UploadStatus) {
  return status !== "done" && status !== "uploading" && !active.has(id);
}

export function transferPercent(loaded: number, total: number) {
  if (!Number.isFinite(loaded) || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
}

export function uploadBatchSummary(
  items: readonly { status: UploadStatus; progress: number }[],
) {
  const total = items.length;
  let completed = 0;
  let failed = 0;
  let ratio = 0;

  for (const item of items) {
    if (item.status === "done") {
      completed += 1;
      ratio += 1;
    } else if (item.status === "error") {
      failed += 1;
    } else if (item.status === "uploading") {
      ratio += Math.min(1, Math.max(0, item.progress / 100));
    }
  }

  return {
    total,
    completed,
    failed,
    ratio: total === 0 ? 0 : ratio / total,
    allSucceeded: total > 0 && completed === total,
    settled: total > 0 && completed + failed === total,
  };
}

export function uploadFinishPlan(statuses: readonly UploadStatus[]) {
  const summary = uploadBatchSummary(
    statuses.map((status) => ({
      status,
      progress: status === "done" ? 100 : 0,
    })),
  );
  const showSuccess = summary.allSucceeded;

  return {
    showSuccess,
    closeAfterMs: showSuccess ? GUEST_UPLOAD_CLOSE_MS : null,
  };
}

export function guestEventPath(code: string) {
  return `/e/${encodeURIComponent(code)}`;
}

export function uploadAttemptResult(outcomes: ReadonlyArray<"done" | "error">) {
  const succeeded = outcomes.length > 0 && outcomes.every((outcome) => outcome === "done");

  return {
    succeeded,
    reset: succeeded,
    redirect: succeeded,
  };
}

export function claimUploadStart(inProgress: boolean) {
  return !inProgress;
}
