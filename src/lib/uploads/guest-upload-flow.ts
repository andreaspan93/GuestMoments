export const GUEST_UPLOAD_REDIRECT_MS = 1600;

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
