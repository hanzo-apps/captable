// Renders an investor update from the blocks the editor stores (BlockNote's
// document JSON). Every string reaches the page as React text, so nothing a
// writer stores is ever parsed as markup; a link or image keeps its address only
// when it is http(s) (or mailto, for a link). Anything the renderer does not
// know is dropped, never passed through.

import { Fragment, type ReactNode, createElement } from "react";

type Json = unknown;

const record = (v: Json): Record<string, Json> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};

const list = (v: Json): Json[] => (Array.isArray(v) ? v : []);

const text = (v: Json): string => (typeof v === "string" ? v : "");

/** An address a link or an image may keep, or "" when it may keep none. */
export const safeUrl = (raw: Json, schemes: readonly string[]): string => {
  const value = text(raw).trim();
  if (!value) return "";
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

const LINK_SCHEMES = ["http:", "https:", "mailto:"] as const;
const IMAGE_SCHEMES = ["http:", "https:"] as const;

const ALIGN = new Set(["left", "center", "right", "justify"]);

/** One run of styled text. */
function Styled({ node }: { node: Record<string, Json> }) {
  const styles = record(node.styles);
  let out: ReactNode = text(node.text);
  if (styles.code === true) out = <code>{out}</code>;
  if (styles.bold === true) out = <strong>{out}</strong>;
  if (styles.italic === true) out = <em>{out}</em>;
  if (styles.underline === true) out = <u>{out}</u>;
  if (styles.strike === true) out = <s>{out}</s>;
  return <>{out}</>;
}

/** A block's inline content: styled text and links. */
function Inline({ content }: { content: Json }) {
  return (
    <>
      {list(content).map((item, i) => {
        const node = record(item);
        if (node.type === "text") {
          // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id
          return <Styled key={i} node={node} />;
        }
        if (node.type === "link") {
          const href = safeUrl(node.href, LINK_SCHEMES);
          const inner = <Inline content={node.content} />;
          return href ? (
            // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id
            <a key={i} href={href} rel="noopener noreferrer nofollow">
              {inner}
            </a>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: inline runs have no id
            <Fragment key={i}>{inner}</Fragment>
          );
        }
        return null;
      })}
    </>
  );
}

function alignment(props: Record<string, Json>) {
  const align = text(props.textAlignment);
  return ALIGN.has(align) && align !== "left"
    ? { textAlign: align as "center" | "right" | "justify" }
    : undefined;
}

/** A block's own element, without its children. */
function Body({ block }: { block: Record<string, Json> }) {
  const props = record(block.props);
  const style = alignment(props);
  switch (block.type) {
    case "heading": {
      const level = props.level === 2 ? 2 : props.level === 3 ? 3 : 1;
      return createElement(
        `h${level}`,
        { style },
        <Inline content={block.content} />,
      );
    }
    case "checkListItem":
      return (
        <span style={style}>
          <input type="checkbox" checked={props.checked === true} disabled />{" "}
          <Inline content={block.content} />
        </span>
      );
    case "bulletListItem":
    case "numberedListItem":
      return (
        <span style={style}>
          <Inline content={block.content} />
        </span>
      );
    case "image": {
      const src = safeUrl(props.url, IMAGE_SCHEMES);
      if (!src) return null;
      const caption = text(props.caption);
      return (
        <figure>
          <img src={src} alt={caption} />
          {caption ? <figcaption>{caption}</figcaption> : null}
        </figure>
      );
    }
    case "table": {
      const rows = list(record(block.content).rows);
      return (
        <table>
          <tbody>
            {rows.map((row, r) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: table rows have no id
              <tr key={r}>
                {list(record(row).cells).map((cell, c) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: table cells have no id
                  <td key={c}>
                    <Inline content={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    default:
      return (
        <p style={style}>
          <Inline content={block.content} />
        </p>
      );
  }
}

const LIST_TAG: Record<string, "ul" | "ol"> = {
  bulletListItem: "ul",
  checkListItem: "ul",
  numberedListItem: "ol",
};

/** Blocks in order, with consecutive list items of one kind in one list. */
export function Blocks({ blocks }: { blocks: Json }) {
  const items = list(blocks).map(record);
  const out: ReactNode[] = [];
  for (let i = 0; i < items.length; ) {
    const block = items[i] as Record<string, Json>;
    const tag = LIST_TAG[text(block.type)];
    if (!tag) {
      out.push(
        <Fragment key={text(block.id) || i}>
          <Body block={block} />
          <Blocks blocks={block.children} />
        </Fragment>,
      );
      i += 1;
      continue;
    }
    const run: Record<string, Json>[] = [];
    while (i < items.length && items[i]?.type === block.type) {
      run.push(items[i] as Record<string, Json>);
      i += 1;
    }
    out.push(
      createElement(
        tag,
        { key: text(block.id) || `list-${i}` },
        run.map((item, n) => (
          <li key={text(item.id) || n}>
            <Body block={item} />
            <Blocks blocks={item.children} />
          </li>
        )),
      ),
    );
  }
  return <>{out}</>;
}
