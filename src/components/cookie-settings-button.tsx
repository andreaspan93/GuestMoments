"use client";

import { COOKIE_SETTINGS_EVENT } from "@/lib/consent";

export function CookieSettingsButton({
  label,
  className = "underline underline-offset-4",
}: {
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      {label}
    </button>
  );
}
