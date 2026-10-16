import { type UploadRequest, presignUpload } from "@/server/storage";
import { putFile } from "./put-file";

export type { TUploadFile } from "./put-file";

/**
 * Uploads a file from the browser. The URL it PUTs to is minted by the
 * `presignUpload` action, which decides where it lands: the caller's account
 * or the company they are an active member of.
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
  { keyPrefix }: Pick<UploadRequest, "keyPrefix">,
  bucketMode: UploadRequest["bucketMode"] = "privateBucket",
) => {
  const presigned = await presignUpload({
    contentType: file.type,
    fileName: file.name,
    bucketMode,
    keyPrefix,
  });
  return putFile(file, presigned, bucketMode);
};
