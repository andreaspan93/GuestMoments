export const CONSENT_VERSION = 1;
export const CONSENT_COOKIE = "gm_consent";
export const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
export const COOKIE_SETTINGS_EVENT = "gm-open-cookie-settings";

export type ConsentChoice = {
  version: 1;
  preferences: boolean;
  decidedAt: string;
};

const decidedAtPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export function parseConsent(value: string | undefined | null): ConsentChoice | null {
  if (!value || value.length > 500) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);

    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const record = parsed as Record<string, unknown>;

    if (record.version !== CONSENT_VERSION || typeof record.preferences !== "boolean") {
      return null;
    }

    if (typeof record.decidedAt !== "string" || !decidedAtPattern.test(record.decidedAt)) {
      return null;
    }

    return {
      version: 1,
      preferences: record.preferences,
      decidedAt: record.decidedAt,
    };
  } catch {
    return null;
  }
}

export function serializeConsent(preferences: boolean, decidedAt = new Date()) {
  const choice: ConsentChoice = {
    version: CONSENT_VERSION,
    preferences,
    decidedAt: decidedAt.toISOString(),
  };

  return JSON.stringify(choice);
}

export function preferenceCookiesToClear(
  _consentValue: string | undefined,
): { name: string; path: string }[] {
  // Language cookies are strictly necessary for the locale switcher. The
  // application does not set any non-essential cookie to clear.
  return [];
}
