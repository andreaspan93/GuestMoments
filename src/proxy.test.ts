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
  });

  it("keeps the default locale unprefixed", () => {
    const response = proxy(request("/", "el"));
    const location = response.headers.get("location") ?? "";

    expect(location).not.toContain("/el");
  });
});
