"use server";

// The two object-store calls a browser may make. Each is a Server Action — a
// public endpoint anyone can POST to — so each decides for itself who is
// asking: a signed-in person, and for anything of a company's, an ACTIVE
// member of it. The signing itself is ./file-uploads.ts, which checks nothing
// and is reachable from server code alone.

import { uploadRefusal } from "@/lib/upload-policy";
import { checkMembership, getServerAuthSession } from "@/server/auth";
import { companyStands } from "@/server/company";
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

/** An upload a browser may ask to be signed. Where it lands is decided here. */
export type UploadRequest = Pick<
  getPresignedUrlOptions,
  "contentType" | "fileName" | "keyPrefix" | "bucketMode"
>;

/**
 * A presigned PUT for an ACTIVE member: a profile photo under their account,
 * anything else under their company's public id, and a public object only as
 * an allowed picture (uploadRefusal). The one upload without a membership is
 * the founder's logo, made before the company it belongs to exists. The key's
 * prefix is minted here, never taken from the caller.
 */
export async function presignUpload(request: UploadRequest) {
  const session = await signedIn();
  const { keyPrefix, bucketMode, contentType, fileName } = request;

  const refusal = uploadRefusal({ keyPrefix, bucketMode, contentType });
  if (refusal) throw new Error(refusal);

  const membership = await activeMembership(session);
  let identifier: string;
  if (membership) {
    identifier =
      keyPrefix === "profile-avatars"
        ? session.user.id
        : (
            await db.company.findUniqueOrThrow({
              where: { id: membership.companyId },
              select: { publicId: true },
            })
          ).publicId;
  } else if (keyPrefix === "company-logos" && !(await companyStands())) {
    identifier = session.user.id;
  } else {
    throw refused();
  }

  return getPresignedPutUrl({
    contentType,
    fileName,
    keyPrefix,
    bucketMode,
    identifier,
  });
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
