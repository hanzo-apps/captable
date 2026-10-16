import { describe, expect, it } from "vitest";
import { companyOwnsKey, uploadRefusal } from "./upload-policy";

describe("uploadRefusal", () => {
  const up = (
    keyPrefix: string,
    bucketMode: "publicBucket" | "privateBucket",
    contentType: string,
  ) => uploadRefusal({ keyPrefix, bucketMode, contentType });

  it("signs a logo or an avatar as a public picture", () => {
    expect(up("company-logos", "publicBucket", "image/png")).toBeNull();
    expect(up("profile-avatars", "publicBucket", "image/webp")).toBeNull();
  });

  it("refuses a public object that is not a picture it allows", () => {
    for (const type of ["text/html", "image/svg+xml", "application/pdf", ""]) {
      expect(up("company-logos", "publicBucket", type)).not.toBeNull();
    }
  });

  it("keeps company documents private and pictures public", () => {
    expect(up("generic-documents", "publicBucket", "image/png")).not.toBeNull();
    expect(up("company-logos", "privateBucket", "image/png")).not.toBeNull();
    expect(
      up("generic-documents", "privateBucket", "application/pdf"),
    ).toBeNull();
  });
});

describe("companyOwnsKey", () => {
  it("is a key under the company's own prefix", () => {
    expect(companyOwnsKey("abc123/shares-docs-x-1a2b.pdf", "abc123")).toBe(
      true,
    );
    expect(companyOwnsKey("abc123/data-room/r1-x.pdf", "abc123")).toBe(true);
  });

  it("is never another prefix, a look-alike, or a climb out", () => {
    expect(companyOwnsKey("other/x.pdf", "abc123")).toBe(false);
    expect(companyOwnsKey("abc1234/x.pdf", "abc123")).toBe(false);
    expect(companyOwnsKey("abc123/../other/x.pdf", "abc123")).toBe(false);
    expect(companyOwnsKey("abc123/x.pdf", "")).toBe(false);
  });
});
