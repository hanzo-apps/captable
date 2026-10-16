import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { safeUrl } from "../../lib/update-blocks";
import { Blocks } from "./blocks";

const html = (blocks: unknown) =>
  renderToStaticMarkup(<Blocks blocks={blocks} />);
const text = (t: string, styles = {}) => ({ type: "text", text: t, styles });

describe("an update's blocks", () => {
  it("render text as text, never as markup", () => {
    const out = html([
      {
        id: "a",
        type: "paragraph",
        content: [text('<img src=x onerror="alert(1)"><script>x</script>')],
      },
    ]);
    expect(out).not.toContain("<img");
    expect(out).not.toContain("<script");
    expect(out).toContain("&lt;script&gt;");
  });

  it("keep a link only when its address is http(s) or mailto", () => {
    const link = (href: string) =>
      html([
        {
          type: "paragraph",
          content: [{ type: "link", href, content: [text("go")] }],
        },
      ]);
    expect(link("https://hanzo.ai/x")).toContain('href="https://hanzo.ai/x"');
    expect(link("mailto:a@hanzo.ai")).toContain('href="mailto:a@hanzo.ai"');
    for (const bad of [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "data:text/html,<script>",
      "/relative",
    ]) {
      const out = link(bad);
      expect(out).not.toContain("href");
      expect(out).toContain("go");
    }
  });

  it("drop an image whose address is not http(s)", () => {
    expect(
      html([{ type: "image", props: { url: "javascript:alert(1)" } }]),
    ).toBe("");
    expect(
      html([
        { type: "image", props: { url: "https://x.test/a.png", caption: "A" } },
      ]),
    ).toContain('<img src="https://x.test/a.png" alt="A"/>');
  });

  it("keep headings, styles and lists", () => {
    const out = html([
      { type: "heading", props: { level: 2 }, content: [text("Q3")] },
      { type: "bulletListItem", content: [text("one", { bold: true })] },
      { type: "bulletListItem", content: [text("two")] },
      { type: "numberedListItem", content: [text("first")] },
    ]);
    expect(out).toBe(
      "<h2>Q3</h2><ul><li><span><strong>one</strong></span></li><li><span>two</span></li></ul><ol><li><span>first</span></li></ol>",
    );
  });

  it("render nothing for a document that is not one", () => {
    for (const bad of [null, "<p>x</p>", 7, { type: "paragraph" }]) {
      expect(html(bad)).toBe("");
    }
  });

  it("ignore attributes it does not know", () => {
    const out = html([
      {
        type: "paragraph",
        props: { textAlignment: "center;color:red", onclick: "x" },
        content: [text("t", { textColor: "url(javascript:x)" })],
      },
    ]);
    expect(out).toBe("<p>t</p>");
  });
});

describe("safeUrl", () => {
  it("normalises what it keeps", () => {
    expect(safeUrl(" https://hanzo.ai ", ["https:"])).toBe("https://hanzo.ai/");
    expect(safeUrl(42, ["https:"])).toBe("");
  });
});
