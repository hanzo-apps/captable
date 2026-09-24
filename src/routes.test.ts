import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { AUTH_BASE_PATH } from "./constants/auth";

// Every route this app serves is under /v1: next-auth at /v1/iam, tRPC at
// /v1/trpc, the public REST API at /v1/companies (HIP-0111). An /api/ path is
// neither served nor called.
const src = dirname(fileURLToPath(import.meta.url));
const root = dirname(src);

// A path literal that starts with /api: '/api/…', "/api", `/api/…`, (/api/….
// A third-party URL (https://host/api/…) has its host in front and is not one.
const API_PATH = /['"`(]\/api(\/|['"`])/;

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(e.name) &&
      p !== fileURLToPath(import.meta.url)
      ? [p]
      : [];
  });
}

describe("routes", () => {
  it("serves nothing from src/app/api", () => {
    expect(existsSync(join(src, "app", "api"))).toBe(false);
  });

  it("mounts next-auth at the auth base path", () => {
    expect(AUTH_BASE_PATH).toBe("/v1/iam");
    expect(
      existsSync(join(src, "app", "v1", "iam", "[...nextauth]", "route.ts")),
    ).toBe(true);
  });

  it("names no /api/ path in source", () => {
    const hits = [...files(src), join(root, "next.config.js")].flatMap((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .map((line, i) => ({ line, at: `${relative(root, f)}:${i + 1}` }))
        .filter(({ line }) => API_PATH.test(line))
        .map(({ at, line }) => `${at}: ${line.trim()}`),
    );
    expect(hits).toEqual([]);
  }, 60_000);
});
