import type { getPresignedUrlOptions } from "@/server/file-uploads";
import { presignUpload } from "@/server/storage";
import { putFile } from "./put-file";

export type { TUploadFile } from "./put-file";

/**
 * Uploads a file from the browser. The URL it PUTs to is minted by the
 * `presignUpload` action, which signs only for the caller's own account or the
 * company they are an active member of.
 *
 * usage
 * ```js
 * import { uploadFile } from '@/common/uploads'
 *
 * const handleUpload = async (file: File) => {
 *   const { uploadKey } = await uploadFile(file);
 *
 *   // save to the database
 *   saveDB({ uploadKey });
 * };
 * ```
 */
export const uploadFile = async (
  file: File,
  options: Pick<
    getPresignedUrlOptions,
    "expiresIn" | "keyPrefix" | "identifier"
  >,
  bucketMode: "publicBucket" | "privateBucket" = "privateBucket",
) => {
  const presigned = await presignUpload({
    contentType: file.type,
    fileName: file.name,
    bucketMode,
    ...options,
  });
  return putFile(file, presigned, bucketMode);
};
