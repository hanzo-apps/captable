export const IS_IAM_ENABLED = true;

// Where next-auth is mounted: src/app/v1/iam/[...nextauth]. next-auth v4 takes
// its server-side mount from the PATH of NEXTAUTH_URL (src/env.js refuses any
// other path) and its browser-side mount from SessionProvider's basePath, so
// both read this one value.
export const AUTH_BASE_PATH = "/v1/iam";
