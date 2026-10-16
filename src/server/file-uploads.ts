// Server-only: these sign with the store's own credentials and check nothing.
// The browser reaches them only through the checks in ./storage.ts.
import "server-only";

import path from "node:path";
import { customId } from "@/common/id";
import { putFile } from "@/common/put-file";
import { env } from "@/env";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import slugify from "@sindresorhus/slugify";

const region = env.UPLOAD_REGION;
const endpoint = env.UPLOAD_ENDPOINT;
const accessKeyId = env.UPLOAD_ACCESS_KEY_ID;
const secretAccessKey = env.UPLOAD_SECRET_ACCESS_KEY;
const hasCredentials = accessKeyId && secretAccessKey;
const PrivateBucket = env.UPLOAD_BUCKET_PRIVATE;
const PublicBucket = env.UPLOAD_BUCKET_PUBLIC;

// Path-style URLs (<endpoint>/<bucket>/<key>): the endpoint host serves every
// bucket, so a signed URL never needs a per-bucket hostname.
const S3 = new S3Client({
  region,
  endpoint,
  forcePathStyle: true,
  credentials: hasCredentials
    ? {
        secretAccessKey,
        accessKeyId,
      }
    : undefined,
});

export type TypeKeyPrefixes =
  | "new-safes"
  | "existing-safes"
  | "signed-esign-doc"
  | "unsigned-esign-doc"
  | "stock-option-docs"
  | "company-logos"
  | "profile-avatars"
  | "generic-documents"
  | "shares-docs"
  | `data-room/${string}`;

export interface getPresignedUrlOptions {
  contentType: string;
  expiresIn?: number;
  fileName: string;
  keyPrefix: TypeKeyPrefixes;
  // should be companyPublicId or memberId or userId
  identifier: string;
  bucketMode: "privateBucket" | "publicBucket";
}

const TEN_MINUTES_IN_SECONDS = 10 * 60;

export const getPresignedPutUrl = async ({
  contentType,
  expiresIn,
  fileName,
  keyPrefix,
  identifier,
  bucketMode,
}: getPresignedUrlOptions) => {
  const { name, ext } = path.parse(fileName);

  const Key = `${identifier}/${keyPrefix}-${slugify(name)}-${customId(
    12,
  )}${ext}`;

  // A public object is served to anyone, so the type and disposition it is
  // served with are signed into its PUT: an upload carrying any others is
  // refused by the store. A private object is only ever read through a signed
  // GET, and keeps the octet-stream type its bytes have always been sent with.
  const isPublic = bucketMode === "publicBucket";
  const headers: Record<string, string> = isPublic
    ? { "Content-Type": contentType, "Content-Disposition": "inline" }
    : { "Content-Type": "application/octet-stream" };

  const putObjectCommand = new PutObjectCommand({
    Bucket: isPublic ? PublicBucket : PrivateBucket,
    Key,
    ContentType: contentType,
    ...(isPublic && { ContentDisposition: "inline" }),
    ACL: isPublic ? "public-read" : "private",
  });

  const url: string = await getSignedUrl(S3, putObjectCommand, {
    expiresIn: expiresIn ?? TEN_MINUTES_IN_SECONDS,
    ...(isPublic && { signableHeaders: new Set(["content-type"]) }),
  });

  const bucketUrl = new URL(url);
  bucketUrl.search = "";

  return { url, key: Key, bucketUrl: bucketUrl.toString(), headers };
};

export const getPresignedGetUrl = async (
  key: string,
  expiresIn = TEN_MINUTES_IN_SECONDS,
) => {
  const getObjectCommand = new GetObjectCommand({
    Bucket: PrivateBucket,
    Key: key,
    // ResponseContentDisposition: `attachment; filename="${key}"`,
    ResponseContentDisposition: "inline",
  });

  const url = await getSignedUrl(S3, getObjectCommand, { expiresIn });

  return { key, url };
};

export const deleteBucketFile = async (key: string) => {
  return await S3.send(
    new DeleteObjectCommand({
      Bucket: process.env.UPLOAD_BUCKET_PRIVATE,
      Key: key,
    }),
  );
};

/** Uploads a file the server holds (a generated PDF), signing the PUT itself. */
export const storeFile = async (
  file: File,
  options: Pick<
    getPresignedUrlOptions,
    "expiresIn" | "keyPrefix" | "identifier"
  >,
  bucketMode: "publicBucket" | "privateBucket" = "privateBucket",
) => {
  const presigned = await getPresignedPutUrl({
    contentType: file.type,
    fileName: file.name,
    bucketMode,
    ...options,
  });
  return putFile(file, presigned, bucketMode);
};

/** Reads an object's bytes from the private bucket. */
export const getFileFromS3 = async (key: string) => {
  const { url } = await getPresignedGetUrl(key);

  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get file "${key}", failed with status code ${response.status}`,
    );
  }

  const buffer = await response.arrayBuffer();

  return new Uint8Array(buffer);
};
