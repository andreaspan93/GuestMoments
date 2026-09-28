import { describe, expect, it } from "vitest";
import {
  clearLegacyGuestTokenStorage,
  clearReadableGuestCookies,
} from "@/components/guest-token-cleanup";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("legacy guest token storage", () => {
  it("removes gm-guest-token keys and leaves other storage alone", () => {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    local.setItem("gm-guest-token:event-code", "secret-token");
    local.setItem("NEXT_LOCALE", "el");
    session.setItem("gm-guest-token:other", "secret-token");
    session.setItem("draft", "keep");
    viStub(local, session);

    clearLegacyGuestTokenStorage();

    expect(local.getItem("gm-guest-token:event-code")).toBeNull();
    expect(local.getItem("NEXT_LOCALE")).toBe("el");
    expect(session.getItem("gm-guest-token:other")).toBeNull();
    expect(session.getItem("draft")).toBe("keep");
  });

  it("expires guest cookies that JavaScript can read", () => {
    const written: string[] = [];
    viStub(new MemoryStorage(), new MemoryStorage());
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        get cookie() {
          return "gm_guest_demo=secret-token; NEXT_LOCALE=en";
        },
        set cookie(value: string) {
          written.push(value);
        },
      },
    });

    clearReadableGuestCookies();

    expect(written).toEqual([
      "gm_guest_demo=; Path=/; Max-Age=0; SameSite=Lax",
      "gm_guest_demo=; Path=/e; Max-Age=0; SameSite=Lax",
      "gm_guest_demo=; Path=/e/demo; Max-Age=0; SameSite=Lax",
    ]);
    expect(written.join("")).not.toContain("secret-token");
  });
});

function viStub(local: Storage, session: Storage) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: local,
  });
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: session,
  });
  Object.defineProperty(globalThis, "indexedDB", {
    configurable: true,
    value: {},
  });
}
