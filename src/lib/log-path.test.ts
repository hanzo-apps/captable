import { describe, expect, it } from "vitest";
import { loggedPath } from "./log-path";

describe("loggedPath", () => {
  it("replaces the secret after an invitation or a signing link", () => {
    expect(loggedPath("/verify-member/3f9c0a1b")).toBe("/verify-member/:token");
    expect(loggedPath("/esign/eyJhbGciOi.x.y")).toBe("/esign/:token");
  });

  it("keeps every other segment", () => {
    expect(loggedPath("/v1/trpc/member.acceptMember")).toBe(
      "/v1/trpc/member.acceptMember",
    );
    expect(loggedPath("/data-rooms/abc123")).toBe("/data-rooms/abc123");
    expect(loggedPath("/")).toBe("/");
  });

  it("leaves a route with no secret yet as it is", () => {
    expect(loggedPath("/verify-member/")).toBe("/verify-member/");
  });
});
