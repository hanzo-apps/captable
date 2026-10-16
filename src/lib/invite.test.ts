import { describe, expect, it } from "vitest";
import {
  generateMemberIdentifier,
  isPlaceholder,
  parseMemberIdentifier,
  sameAddress,
} from "./invite";

describe("invitation identifiers", () => {
  it("round-trips the address and the seat", () => {
    const id = generateMemberIdentifier({
      email: " Ada@Example.com ",
      memberId: "clxwbok580000i7nge8nm1ry0",
    });
    expect(id).toBe("ada@example.com:clxwbok580000i7nge8nm1ry0");
    expect(parseMemberIdentifier(id)).toEqual({
      email: "ada@example.com",
      memberId: "clxwbok580000i7nge8nm1ry0",
    });
  });

  it("names no seat when either half is missing", () => {
    expect(parseMemberIdentifier("ada@example.com")).toBeNull();
    expect(parseMemberIdentifier(":clxwbok58")).toBeNull();
    expect(parseMemberIdentifier("ada@example.com:")).toBeNull();
  });
});

describe("sameAddress", () => {
  it("ignores case and surrounding space", () => {
    expect(sameAddress("Ada@Example.com", " ada@example.com")).toBe(true);
  });

  it("never matches an absent or empty address", () => {
    expect(sameAddress(null, "ada@example.com")).toBe(false);
    expect(sameAddress(undefined, "ada@example.com")).toBe(false);
    expect(sameAddress("", "")).toBe(false);
    expect(sameAddress("ada@example.com", " ")).toBe(false);
  });

  it("tells two mailboxes apart", () => {
    expect(sameAddress("ada@example.com", "eve@example.com")).toBe(false);
  });
});

describe("isPlaceholder", () => {
  const none = { email: null, password: null, _count: { accounts: 0 } };

  it("is a row with no address, no password and no sign-in", () => {
    expect(isPlaceholder(none)).toBe(true);
  });

  it("is never a row someone can sign in as or be reached at", () => {
    expect(isPlaceholder({ ...none, email: "ada@example.com" })).toBe(false);
    expect(isPlaceholder({ ...none, password: "$2a$10$x" })).toBe(false);
    expect(isPlaceholder({ ...none, _count: { accounts: 1 } })).toBe(false);
  });
});
