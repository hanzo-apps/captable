import type { TPrismaOrTransaction } from "@/server/db";

/**
 * A security's paperwork is this app's own — S3 buckets, member uploaders, data
 * rooms, e-sign — so it stays here while the security it describes lives in
 * Hanzo Cloud. The link column holds the id the backend assigned, which is why
 * it is a plain column and no longer a foreign key.
 */
export type SecurityLink =
  | "shareId"
  | "optionId"
  | "safeId"
  | "convertibleNoteId";

const SELECT = {
  id: true,
  name: true,
  uploader: { select: { user: { select: { name: true, image: true } } } },
  bucket: { select: { key: true, mimeType: true, size: true } },
} as const;

export interface SecurityDocument {
  id: string;
  name: string;
  uploader: { user: { name: string | null; image: string | null } } | null;
  bucket: { key: string; mimeType: string; size: number };
}

/** The documents attached to each of `ids`, keyed by security id. */
export async function documentsBySecurity(
  db: TPrismaOrTransaction,
  link: SecurityLink,
  ids: string[],
): Promise<Map<string, SecurityDocument[]>> {
  const byId = new Map<string, SecurityDocument[]>();
  if (ids.length === 0) return byId;

  const where =
    link === "shareId"
      ? { shareId: { in: ids } }
      : link === "optionId"
        ? { optionId: { in: ids } }
        : link === "safeId"
          ? { safeId: { in: ids } }
          : { convertibleNoteId: { in: ids } };

  const rows = await db.document.findMany({
    where,
    select: {
      ...SELECT,
      shareId: true,
      optionId: true,
      safeId: true,
      convertibleNoteId: true,
    },
  });

  for (const row of rows) {
    const { shareId, optionId, safeId, convertibleNoteId, ...doc } = row;
    const key = { shareId, optionId, safeId, convertibleNoteId }[link];
    if (!key) continue;
    const list = byId.get(key);
    if (list) list.push(doc);
    else byId.set(key, [doc]);
  }

  return byId;
}
