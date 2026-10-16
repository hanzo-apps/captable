import { companyOwnsKey } from "@/lib/upload-policy";
import { getPresignedGetUrl } from "@/server/file-uploads";
import { TRPCError } from "@trpc/server";
import type { TPrismaOrTransaction } from "./db";

// A Bucket row records an object in the store and names no company, so a
// company's claim to an object is its key: filed under the company's own
// prefixes (companyOwnsKey). Every row that points at a bucket on a member's
// say, and every GET signed for a company's document, is checked here.

export const NOT_THIS_COMPANYS = "This file was not uploaded for this company.";

/** The prefixes a company's objects are filed under: its public id and its id. */
export const companyPrefixes = async (
  tx: TPrismaOrTransaction,
  companyId: string,
) => {
  const { publicId } = await tx.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { publicId: true },
  });
  return [publicId, companyId];
};

/** Refuses unless every bucket exists and holds one of the company's objects. */
export async function assertCompanyBuckets(
  tx: TPrismaOrTransaction,
  companyId: string,
  bucketIds: string[],
) {
  const ids = [...new Set(bucketIds)];
  if (!ids.length) return;
  const [prefixes, buckets] = await Promise.all([
    companyPrefixes(tx, companyId),
    tx.bucket.findMany({ where: { id: { in: ids } }, select: { key: true } }),
  ]);
  if (
    buckets.length !== ids.length ||
    !buckets.every(({ key }) => companyOwnsKey(key, prefixes))
  ) {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_THIS_COMPANYS });
  }
}

/** A signed GET for one of the company's objects, refused for any other key. */
export async function companyObjectUrl(
  tx: TPrismaOrTransaction,
  companyId: string,
  key: string,
) {
  if (!companyOwnsKey(key, await companyPrefixes(tx, companyId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: NOT_THIS_COMPANYS });
  }
  return getPresignedGetUrl(key);
}
