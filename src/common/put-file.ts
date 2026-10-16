import { env } from "@/env";

/** A presigned PUT, as either side of the app mints it. */
export interface PresignedPut {
  url: string;
  key: string;
  bucketUrl: string;
  /** The headers the PUT is signed with, sent exactly as given. */
  headers: Record<string, string>;
}

/** Sends a file's bytes to the object store through a presigned PUT. */
export const putFile = async (
  file: File,
  { url, key, bucketUrl, headers }: PresignedPut,
  bucketMode: "publicBucket" | "privateBucket",
) => {
  const body = await file.arrayBuffer();
  const res = await fetch(url, {
    method: "PUT",
    headers,
    body,
  });
  if (!res.ok) {
    throw new Error(
      `Failed to upload file "${file.name}", failed with status code ${res.status}`,
    );
  }

  const { name, type, size } = file;
  let fileUrl = bucketUrl;

  const uploadDomain =
    process.env.NEXT_PUBLIC_UPLOAD_DOMAIN || env.NEXT_PUBLIC_UPLOAD_DOMAIN;

  if (bucketMode === "publicBucket" && uploadDomain) {
    fileUrl = `${uploadDomain}/${key}`;
  }

  return {
    key,
    name,
    mimeType: type,
    size,
    fileUrl,
  };
};

export type TUploadFile = Awaited<ReturnType<typeof putFile>>;
