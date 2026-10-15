export function pathAfterEventCreated() {
  return "/events";
}

export function pathAfterEventUpdated() {
  return "/events";
}

export function shouldRedirectAfterEdit(saveSucceeded: boolean, uploadsSucceeded: boolean) {
  return saveSucceeded && uploadsSucceeded;
}
