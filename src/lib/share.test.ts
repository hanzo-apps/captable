import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { recipientMayOpen } from "./share";

describe("recipientMayOpen", () => {
  it("opens for a recipient who is not a member", () => {
    expect(recipientMayOpen({ memberId: null, member: null })).toBe(true);
  });

  it("opens for a member only while ACTIVE", () => {
    const at = (status: string) =>
      recipientMayOpen({ memberId: "m1", member: { status } });
    expect(at("ACTIVE")).toBe(true);
    expect(at("INACTIVE")).toBe(false);
    expect(at("PENDING")).toBe(false);
  });

  it("refuses a member recipient whose member row is gone", () => {
    expect(recipientMayOpen({ memberId: "m1", member: null })).toBe(false);
  });
});

// A share link is access. It is minted where it is mailed and nowhere else, so
// a read of who something is shared with never hands one out.
const src = dirname(dirname(fileURLToPath(import.meta.url)));
const root = dirname(src);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")
      ? [p]
      : [];
  });
}

describe("share links", () => {
  it("are minted only by the mutations that mail them", () => {
    const mints = files(src).flatMap((f) => {
      const n = (readFileSync(f, "utf8").match(/encodeShare\(/g) ?? []).length;
      return n ? [`${relative(root, f)} ${n}`] : [];
    });
    // add-fields is the signing link, which EncodeEmailToken wraps for the
    // signing mail and the next signer's mail alike.
    expect(mints.sort()).toEqual([
      "src/trpc/routers/data-room-router/router.ts 1",
      "src/trpc/routers/template-field-router/procedures/add-fields.ts 1",
      "src/trpc/routers/update/procedures/share-update.ts 1",
    ]);
  });

  it("are minted in the data room's share mutation, not its read", () => {
    const text = readFileSync(
      join(src, "trpc/routers/data-room-router/router.ts"),
      "utf8",
    );
    const read = text.slice(
      text.indexOf("getDataRoom:"),
      text.indexOf("save:"),
    );
    const share = text.slice(text.indexOf("share:"), text.indexOf("unShare:"));
    expect(read).not.toContain("encodeShare(");
    expect(share).toContain("encodeShare(");
  });
});
