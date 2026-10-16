import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A Bucket names no company, so a row that points at a bucket on a member's
// say is a claim to that object. Every procedure that takes a bucket id from
// its input checks it is the company's (assertCompanyBuckets), and a GET is
// signed for a company's document only after its key is checked
// (companyObjectUrl).
const src = dirname(dirname(fileURLToPath(import.meta.url)));
const root = dirname(src);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)
      ? [p]
      : [];
  });
}

const read = (f: string) => readFileSync(f, "utf8");

describe("bucket ownership", () => {
  it("is checked by every procedure that takes a bucket id from its input", () => {
    const takers = files(join(src, "trpc", "routers"))
      .filter(
        (f) =>
          /\binput\.(?:bucketId|document\.bucketId|documents)\b|doc\.bucketId/.test(
            read(f),
          ) || /procedures\/create-(?:document|template)\.ts$/.test(f),
      )
      .map((f) => relative(root, f))
      .sort();
    expect(takers).toEqual([
      "src/trpc/routers/document-router/procedures/create-document.ts",
      "src/trpc/routers/safe/procedures/add-existing-safe.ts",
      "src/trpc/routers/safe/procedures/create-safe.ts",
      "src/trpc/routers/securities-router/procedures/add-option.ts",
      "src/trpc/routers/securities-router/procedures/add-share.ts",
      "src/trpc/routers/template-router/procedures/create-template.ts",
    ]);
    for (const f of takers) {
      expect(read(join(root, f)), f).toContain("assertCompanyBuckets(");
    }
  });

  it("is checked before a GET is signed for a company's document", () => {
    const signers = files(src)
      .filter((f) => /getPresignedGetUrl\(/.test(read(f)))
      .map((f) => relative(root, f))
      .sort();
    // file-uploads defines it; bucket.ts is the checked path; the e-sign job and
    // the two template reads sign what a company-scoped template row names.
    expect(signers).toEqual([
      "src/jobs/esign-complete-pdf.ts",
      "src/server/bucket.ts",
      "src/server/file-uploads.ts",
      "src/trpc/routers/template-router/procedures/get-signing-fields.tsx",
      "src/trpc/routers/template-router/procedures/get-template.ts",
    ]);
  });
});
