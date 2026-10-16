// The Content-Security-Policy the app's pages are served with.
//
// script-src keeps 'unsafe-inline': Next's App Router streams its payload in
// inline <script> tags and PublicEnvScript writes window env inline, and a
// nonce-based policy has not been run against the app. It still refuses every
// script from another origin, and the other directives hold in full.

/** The origin of a configured URL, or "" when it is not one. */
const originOf = (url: string | undefined) => {
  try {
    return url ? new URL(url).origin : "";
  } catch {
    return "";
  }
};

export interface CspOrigins {
  /** The object store the browser uploads to and previews from (UPLOAD_ENDPOINT). */
  store?: string;
  /** The identity provider (IAM_URL). */
  iam?: string;
  /** Where Sentry reports go (NEXT_PUBLIC_SENTRY_DSN). */
  sentry?: string;
}

/**
 * The policy for the given origins. The store and IAM default to the hosts this
 * app is deployed against, so a policy built where the environment is absent
 * (a build, the edge runtime) still lets uploads and sign-in through.
 */
export const contentSecurityPolicy = ({ store, iam, sentry }: CspOrigins) => {
  const at = (...urls: (string | undefined)[]) =>
    urls.map(originOf).filter(Boolean);
  const storeOrigin = at(store || "https://s3.hanzo.ai");
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'"],
    // Next, Radix and the editor set styles inline.
    "style-src": ["'self'", "'unsafe-inline'"],
    // Avatars come from whichever host IAM's picture claim names, and an image
    // runs no code, so any https image may load.
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [
      "'self'",
      "https://api.hanzo.ai",
      ...at(iam || "https://hanzo.id", sentry),
      ...storeOrigin,
    ],
    "media-src": ["'self'", ...storeOrigin],
    // Office documents preview through Microsoft's viewer.
    "frame-src": ["https://view.officeapps.live.com"],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  return Object.entries(directives)
    .map(([name, sources]) => `${name} ${[...new Set(sources)].join(" ")}`)
    .join("; ");
};

/**
 * Whether a path is one of the app's pages. Everything under /v1 is an API —
 * next-auth, tRPC, the REST API and its Swagger UI, which loads its own
 * scripts — and answers without the page policy.
 */
export const servesPage = (pathname: string) =>
  pathname !== "/v1" && !pathname.startsWith("/v1/");
