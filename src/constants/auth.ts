import { env } from "@/env";

export const IS_GOOGLE_AUTH_ENABLED = !!(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
);

export const IS_HANZO_IAM_ENABLED = !!process.env.HANZO_IAM_CLIENT_ID;
