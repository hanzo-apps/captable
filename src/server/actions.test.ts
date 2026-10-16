import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// A "use server" module turns every export into a public POST endpoint, so a
// module that is one must decide who is asking before it does anything. The
// object-store signers in file-uploads.ts check nothing and are server-only;
// storage.ts is the one module a browser reaches them through.
const src = dirname(dirname(fileURLToPath(import.meta.url)));
const root = dirname(src);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
  });
}

const USE_SERVER = /^\s*["']use server["'];?/m;

describe("server actions", () => {
  it("are declared in storage.ts and nowhere else", () => {
    const modules = files(src)
      .filter((f) => USE_SERVER.test(readFileSync(f, "utf8")))
      .map((f) => relative(root, f));
    expect(modules).toEqual(["src/server/storage.ts"]);
  });

  it("each establish a signed-in caller first", () => {
    const text = readFileSync(join(src, "server", "storage.ts"), "utf8");
    const actions = [
      ...text.matchAll(/export async function (\w+)\([^)]*\)\s*{\s*([^\n]*)/g),
    ];
    expect(actions.map(([, name]) => name)).toEqual([
      "presignUpload",
      "presignDownload",
    ]);
    for (const [, , first] of actions) {
      expect(first).toContain("await signedIn()");
    }
  });

  it("keep the unchecked signers server-only", () => {
    const text = readFileSync(join(src, "server", "file-uploads.ts"), "utf8");
    expect(text).toMatch(/import "server-only";/);
    expect(USE_SERVER.test(text)).toBe(false);
  });
});
