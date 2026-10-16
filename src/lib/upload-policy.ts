// What a browser may put in the object store, and where.

/** The prefixes whose objects are pictures served to anyone, from the public bucket. */
export const PUBLIC_PREFIXES = ["company-logos", "profile-avatars"] as const;

/** The picture types a public object may be. No SVG: it can carry script. */
export const PUBLIC_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

const isPublicPrefix = (prefix: string) =>
  (PUBLIC_PREFIXES as readonly string[]).includes(prefix);

/**
 * Why an upload may not be signed, or null when it may: a public object is one
 * of the public prefixes and an allowed picture type, and every other prefix
 * goes to the private bucket.
 */
export const uploadRefusal = ({
  keyPrefix,
  bucketMode,
  contentType,
}: {
  keyPrefix: string;
  bucketMode: "publicBucket" | "privateBucket";
  contentType: string;
}): string | null => {
  if (isPublicPrefix(keyPrefix) !== (bucketMode === "publicBucket")) {
    return "This file cannot be stored there.";
  }
  if (
    bucketMode === "publicBucket" &&
    !(PUBLIC_IMAGE_TYPES as readonly string[]).includes(contentType)
  ) {
    return "Upload a PNG, JPEG, WebP or GIF image.";
  }
  return null;
};

/**
 * Whether an object key was minted for this company: every key a member's
 * upload is signed for starts with the company's public id (the store signs
 * that prefix itself), so a key under any other prefix is another owner's.
 */
export const companyOwnsKey = (key: string, companyPublicId: string) =>
  !!companyPublicId &&
  key.startsWith(`${companyPublicId}/`) &&
  !key.split("/").includes("..");
