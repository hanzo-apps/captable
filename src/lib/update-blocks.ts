// The addresses an investor update may carry, and the one cleaning every
// stored update goes through. The editor (BlockNote over TipTap) keeps whatever
// href or src it is given, so an update is cleaned on the server before it is
// written, and its renderer applies the same rule again when it is read.

type Json = unknown;

const record = (v: Json): Record<string, Json> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, Json>)
    : {};

const list = (v: Json): Json[] => (Array.isArray(v) ? v : []);

export const LINK_SCHEMES = ["http:", "https:", "mailto:"] as const;
export const MEDIA_SCHEMES = ["http:", "https:"] as const;

/** An address a link or an image may keep, or "" when it may keep none. */
export const safeUrl = (raw: Json, schemes: readonly string[]): string => {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return "";
  try {
    const url = new URL(value);
    return schemes.includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
};

/** Inline content with every link's href made safe; a link that keeps none becomes its text. */
const cleanInline = (content: Json): Json => {
  if (!Array.isArray(content)) return content;
  return content.flatMap((item) => {
    const node = record(item);
    if (node.type !== "link") return [item];
    const href = safeUrl(node.href, LINK_SCHEMES);
    const inner = cleanInline(node.content);
    return href ? [{ ...node, href, content: inner }] : list(inner);
  });
};

const cleanBlock = (block: Record<string, Json>): Record<string, Json> => {
  const out: Record<string, Json> = { ...block };
  const props = record(block.props);
  if ("url" in props) {
    out.props = { ...props, url: safeUrl(props.url, MEDIA_SCHEMES) };
  }
  const content = record(block.content);
  if (Array.isArray(block.content)) {
    out.content = cleanInline(block.content);
  } else if (content.type === "tableContent") {
    out.content = {
      ...content,
      rows: list(content.rows).map((row) => ({
        ...record(row),
        cells: list(record(row).cells).map(cleanInline),
      })),
    };
  }
  if (Array.isArray(block.children)) out.children = cleanBlocks(block.children);
  return out;
};

/**
 * A stored update's blocks with every link href and every media url (image,
 * video, audio, file) kept only when it is safe; anything that is not a block
 * is dropped, and anything that is not an array of blocks is none.
 */
export const cleanBlocks = (blocks: Json): Record<string, Json>[] =>
  list(blocks)
    .filter((b) => b && typeof b === "object" && !Array.isArray(b))
    .map((b) => cleanBlock(b as Record<string, Json>));
