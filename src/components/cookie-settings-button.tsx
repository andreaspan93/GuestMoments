"use client";

import { COOKIE_SETTINGS_EVENT } from "@/lib/consent";

export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="underline underline-offset-4"
      onClick={() => window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT))}
    >
      {label}
    </button>
  );
}
