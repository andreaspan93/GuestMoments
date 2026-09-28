export function eventStatusLabelKey(status: string) {
  if (status === "ACTIVE") {
    return "active" as const;
  }

  if (status === "EXPIRED") {
    return "expired" as const;
  }

  return "disabled" as const;
}
