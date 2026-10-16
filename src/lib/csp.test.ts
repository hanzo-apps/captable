import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, servesPage } from "./csp";

const policy = contentSecurityPolicy({
  store: "https://s3.hanzo.ai",
  iam: "https://hanzo.id",
  sentry: "https://abc@o1.ingest.sentry.io/2",
});
const directive = (name: string) =>
  policy
    .split("; ")
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1)
    .split(" ");

describe("contentSecurityPolicy", () => {
  it("defaults to the app's own origin and refuses plugins, framing and base rewrites", () => {
    expect(directive("default-src")).toEqual(["'self'"]);
    expect(directive("object-src")).toEqual(["'none'"]);
    expect(directive("frame-ancestors")).toEqual(["'none'"]);
    expect(directive("base-uri")).toEqual(["'self'"]);
  });

  it("loads script from the app's origin alone", () => {
    const script = directive("script-src") ?? [];
    expect(script).toContain("'self'");
    expect(script.filter((s) => !s.startsWith("'"))).toEqual([]);
    expect(script).not.toContain("'unsafe-eval'");
  });

  it("connects to the app, the store, IAM, the API and Sentry only", () => {
    expect(directive("connect-src")).toEqual([
      "'self'",
      "https://api.hanzo.ai",
      "https://hanzo.id",
      "https://o1.ingest.sentry.io",
      "https://s3.hanzo.ai",
    ]);
  });

  it("previews media from the store", () => {
    expect(directive("media-src")).toEqual(["'self'", "https://s3.hanzo.ai"]);
  });

  it("drops an origin that is not a URL", () => {
    const loose = contentSecurityPolicy({ store: "not a url" });
    expect(loose).toContain(
      "connect-src 'self' https://api.hanzo.ai https://hanzo.id;",
    );
    expect(loose).toContain("media-src 'self';");
  });

  it("lets uploads and previews through where no store is configured", () => {
    const bare = contentSecurityPolicy({ store: "", iam: undefined });
    expect(bare).toContain(
      "connect-src 'self' https://api.hanzo.ai https://hanzo.id https://s3.hanzo.ai;",
    );
    expect(bare).toContain("media-src 'self' https://s3.hanzo.ai;");
  });
});

describe("servesPage", () => {
  it("is every page and no API path", () => {
    expect(servesPage("/")).toBe(true);
    expect(servesPage("/updates/abc")).toBe(true);
    expect(servesPage("/abc123/documents")).toBe(true);
    expect(servesPage("/v1/trpc/update.save")).toBe(false);
    expect(servesPage("/v1/swagger")).toBe(false);
    expect(servesPage("/v1")).toBe(false);
  });
});
