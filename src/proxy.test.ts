import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "./proxy";

function request(pathname: string, acceptLanguage = "el") {
  return new NextRequest(new URL(pathname, "http://localhost:3000"), {
    headers: { "accept-language": acceptLanguage },
  });
}

describe("locale proxy", () => {
  it("does not redirect /e/demo onto a locale prefix", () => {
    const response = proxy(request("/e/demo", "en"));
    const location = response.headers.get("location") ?? "";

    expect(response.status).not.toBe(307);
    expect(response.status).not.toBe(308);
    expect(location).not.toMatch(/\/(el|en)\/e\/demo/);

    const cookie = response.cookies.get("gm_guest_demo");

    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.value).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(response.headers.get("set-cookie")).not.toContain("gm-guest-token");
  });

  it("reissues a valid guest token as an httpOnly cookie", () => {
    const existing = new NextRequest(new URL("/e/demo", "http://localhost:3000"));
    const token = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    existing.cookies.set("gm_guest_demo", token);
    const response = proxy(existing);
    const cookie = response.cookies.get("gm_guest_demo");

    expect(cookie?.value).toBe(token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
  });

  it("locks a legacy guest cookie from another event", () => {
    const existing = request("/");
    const token = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    existing.cookies.set("gm_guest_VKRjholm-yGCI7jcQG5SLA", token);
    const response = proxy(existing);
    const cookie = response.cookies.get("gm_guest_VKRjholm-yGCI7jcQG5SLA");

    expect(cookie?.value).toBe(token);
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.secure).toBe(true);
    expect(cookie?.sameSite).toBe("lax");
    expect(response.headers.get("set-cookie")).toContain("Path=/e");
    expect(response.headers.get("set-cookie")).not.toContain("HttpOnly=false");
  });

  it("keeps the default locale unprefixed", () => {
    const response = proxy(request("/", "el"));
    const location = response.headers.get("location") ?? "";

    expect(location).not.toContain("/el");
  });
});
