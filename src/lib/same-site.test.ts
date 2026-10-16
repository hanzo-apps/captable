import { describe, expect, it } from "vitest";
import { sameSitePath } from "./same-site";

describe("sameSitePath", () => {
  it("keeps a path on this site", () => {
    expect(sameSitePath("/verify-member/abc", "/onboarding")).toBe(
      "/verify-member/abc",
    );
  });

  it("refuses anything a browser reads as another host", () => {
    for (const path of [
      "//evil.example",
      "/\\evil.example",
      "https://evil.example",
      "evil.example",
      "/\tevil",
    ]) {
      expect(sameSitePath(path, "/onboarding")).toBe("/onboarding");
    }
  });

  it("falls back when there is none", () => {
    expect(sameSitePath(undefined, "/onboarding")).toBe("/onboarding");
    expect(sameSitePath("", "/onboarding")).toBe("/onboarding");
  });
});
