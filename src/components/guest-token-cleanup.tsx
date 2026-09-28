"use client";

import { useEffect } from "react";

const legacyPrefix = "gm-guest-token:";
const guestCookiePrefix = "gm_guest_";

function clearStorage(storage: Storage) {
  const stale: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key?.startsWith(legacyPrefix)) {
      stale.push(key);
    }
  }

  for (const key of stale) {
    storage.removeItem(key);
  }
}

export function clearReadableGuestCookies() {
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0] ?? "")
    .filter((name) => name.startsWith(guestCookiePrefix));

  for (const name of names) {
    const code = name.slice(guestCookiePrefix.length);
    const paths = ["/", "/e", code ? `/e/${code}` : ""].filter(Boolean);

    for (const path of paths) {
      document.cookie = `${name}=; Path=${path}; Max-Age=0; SameSite=Lax`;
    }
  }
}

export function clearLegacyGuestTokenStorage() {
  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);

  if (typeof indexedDB.databases !== "function") {
    return;
  }

  void indexedDB.databases().then((databases) => {
    for (const database of databases) {
      if (database.name?.startsWith(legacyPrefix)) {
        indexedDB.deleteDatabase(database.name);
      }
    }
  });
}

export function GuestTokenCleanup() {
  useEffect(() => {
    clearLegacyGuestTokenStorage();
    clearReadableGuestCookies();
  }, []);

  return null;
}
