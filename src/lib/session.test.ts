import { describe, expect, it } from "vitest";
import { SESSION_MAX_AGE, iamTokenExpiry, sessionLive } from "./session";

const jwt = (claims: object) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;

describe("iamTokenExpiry", () => {
  it("reads the token response's expiry first", () => {
    expect(
      iamTokenExpiry({
        expires_at: 1_700_000_000,
        access_token: jwt({ exp: 1 }),
      }),
    ).toBe(1_700_000_000_000);
  });

  it("falls back to the access token's own exp", () => {
    expect(iamTokenExpiry({ access_token: jwt({ exp: 1_700_000_500 }) })).toBe(
      1_700_000_500_000,
    );
  });

  it("is 0 when neither states one", () => {
    expect(iamTokenExpiry({})).toBe(0);
    expect(iamTokenExpiry({ access_token: "opaque" })).toBe(0);
    expect(iamTokenExpiry({ access_token: jwt({ sub: "x" }) })).toBe(0);
    expect(iamTokenExpiry({ expires_at: null, access_token: "a.!!!.b" })).toBe(
      0,
    );
  });
});

describe("sessionLive", () => {
  const now = 1_700_000_000_000;

  it("holds while the IAM token it signed in with is unexpired", () => {
    expect(
      sessionLive({ hanzoToken: "t", hanzoTokenExpires: now + 1 }, now),
    ).toBe(true);
  });

  it("ends when that token expires", () => {
    expect(sessionLive({ hanzoToken: "t", hanzoTokenExpires: now }, now)).toBe(
      false,
    );
    expect(
      sessionLive({ hanzoToken: "t", hanzoTokenExpires: now - 1 }, now),
    ).toBe(false);
  });

  it("never holds without a token or a stated expiry", () => {
    expect(sessionLive({}, now)).toBe(false);
    expect(sessionLive({ hanzoTokenExpires: now + 1 }, now)).toBe(false);
    expect(sessionLive({ hanzoToken: "t" }, now)).toBe(false);
    expect(sessionLive({ hanzoToken: "t", hanzoTokenExpires: 0 }, 0)).toBe(
      false,
    );
  });
});

describe("SESSION_MAX_AGE", () => {
  it("is shorter than the IAM access token's 168 hours", () => {
    expect(SESSION_MAX_AGE).toBeLessThanOrEqual(168 * 60 * 60);
  });
});
