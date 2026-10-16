"use server";

// The two object-store calls a browser may make. Each is a Server Action — a
// public endpoint anyone can POST to — so each decides for itself who is
// asking: a signed-in person, and for anything of a company's, an ACTIVE
// member of it. The signing itself is ./file-uploads.ts, which checks nothing
// and is reachable from server code alone.

import { checkMembership, getServerAuthSession } from "@/server/auth";
import { db } from "@/server/db";
import {
  getPresignedGetUrl,
  getPresignedPutUrl,
  type getPresignedUrlOptions,
} from "@/server/file-uploads";

const refused = () => new Error("You do not have access to this file.");

/** The signed-in session, or the refusal. */
const signedIn = async () => {
  const session = await getServerAuthSession();
  if (!session?.user?.id) throw refused();
  return session;
};

/** The caller's active membership, or null when they hold none. */
const activeMembership = async (
  session: Awaited<ReturnType<typeof signedIn>>,
) => {
  try {
    return await checkMembership({ session, tx: db });
  } catch {
    return null;
  }
};

/**
 * A presigned PUT, for a file filed under the caller's own account (a profile
 * photo, the logo of a company being founded) or under the company they are an
 * active member of. The object key is minted here, never taken from the caller.
 */
export async function presignUpload(options: getPresignedUrlOptions) {
  const session = await signedIn();
  const { identifier, keyPrefix, bucketMode } = options;

  // Only pictures meant to be shown anywhere go to the public bucket.
  if (
    bucketMode === "publicBucket" &&
    keyPrefix !== "company-logos" &&
    keyPrefix !== "profile-avatars"
  ) {
    throw refused();
  }

  if (identifier !== session.user.id) {
    const membership = await activeMembership(session);
    if (
      !membership ||
      identifier !== session.user.companyPublicId ||
      !session.user.companyPublicId
    ) {
      throw refused();
    }
  }

  // The URL lives for the store's default ten minutes, whatever was asked.
  return getPresignedPutUrl({ ...options, expiresIn: undefined });
}

/**
 * A presigned GET, for an object that is one of the caller's company's
 * documents or e-sign templates. Ownership is read from the rows that file the
 * object, not from the shape of its key.
 */
export async function presignDownload(key: string) {
  const session = await signedIn();
  const membership = await activeMembership(session);
  if (!membership || !key) throw refused();

  const { companyId } = membership;
  const [document, template] = await Promise.all([
    db.document.findFirst({
      where: { companyId, bucket: { key } },
      select: { id: true },
    }),
    db.template.findFirst({
      where: { companyId, bucket: { key } },
      select: { id: true },
    }),
  ]);
  if (!document && !template) throw refused();

  return getPresignedGetUrl(key);
}
