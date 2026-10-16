import { describe, expect, it } from "vitest";
import { cleanBlocks } from "./update-blocks";

const text = (t: string) => ({ type: "text", text: t, styles: {} });
const link = (href: string) => ({ type: "link", href, content: [text("go")] });

describe("cleanBlocks", () => {
  it("unwraps a link whose address may not be kept, in any spelling", () => {
    for (const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " \tjavascript:alert(1)",
      "jav\nascript:alert(1)",
      "data:text/html,<script>x</script>",
      "vbscript:x",
      "/relative",
    ]) {
      const [block] = cleanBlocks([
        { id: "a", type: "paragraph", content: [link(href)] },
      ]);
      expect(block?.content).toEqual([text("go")]);
    }
  });

  it("keeps an http(s) or mailto link", () => {
    const [block] = cleanBlocks([
      { type: "paragraph", content: [link("https://hanzo.ai/q3")] },
    ]);
    expect(block?.content).toEqual([
      { ...link("https://hanzo.ai/q3"), href: "https://hanzo.ai/q3" },
    ]);
  });

  it("blanks a media url that is not http(s)", () => {
    const [image, video] = cleanBlocks([
      { type: "image", props: { url: "javascript:alert(1)", caption: "c" } },
      { type: "video", props: { url: "https://x.test/v.mp4" } },
    ]);
    expect(image?.props).toEqual({ url: "", caption: "c" });
    expect(video?.props).toEqual({ url: "https://x.test/v.mp4" });
  });

  it("cleans nested children and table cells, and keeps everything else", () => {
    const [block] = cleanBlocks([
      {
        id: "t",
        type: "table",
        props: { textColor: "default" },
        content: {
          type: "tableContent",
          rows: [{ cells: [[link("javascript:x")], [text("ok")]] }],
        },
        children: [
          { id: "c", type: "paragraph", content: [link("JAVASCRIPT:x")] },
        ],
      },
    ]);
    expect(block).toEqual({
      id: "t",
      type: "table",
      props: { textColor: "default" },
      content: {
        type: "tableContent",
        rows: [{ cells: [[text("go")], [text("ok")]] }],
      },
      children: [{ id: "c", type: "paragraph", content: [text("go")] }],
    });
  });

  it("is no blocks for anything that is not an array of them", () => {
    expect(cleanBlocks(null)).toEqual([]);
    expect(cleanBlocks("<p>x</p>")).toEqual([]);
    expect(cleanBlocks([7, "x", null, [], { type: "paragraph" }])).toEqual([
      { type: "paragraph" },
    ]);
  });
});
