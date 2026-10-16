// A Captable session lives as long as the IAM access token it signed in with,
// and no longer. IAM decides who may sign in (org hanzo, enabled accounts), so
// a person IAM moves or disables loses Captable when that token expires, and
// the next sign-in goes back through IAM.

/**
 * How long a session lasts unused. It is shorter than the IAM access token's
 * own lifetime (168 hours on admin/hanzo-captable), which bounds every session
 * however often it is used.
 */
export const SESSION_MAX_AGE = 24 * 60 * 60;

/** What a session's token carries about the IAM sign-in behind it. */
export interface IamBinding {
  hanzoToken?: string;
  hanzoTokenExpires?: number;
}

/** The `exp` claim of a JWT, in seconds since the epoch, or 0. */
const jwtExp = (token: string | null | undefined): number => {
  const payload = token?.split(".")[1];
  if (!payload) return 0;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof claims?.exp === "number" ? claims.exp : 0;
  } catch {
    return 0;
  }
};

/**
 * When the access token a sign-in received expires, in milliseconds since the
 * epoch: the token response's `expires_in` (which next-auth keeps as
 * `expires_at`, in seconds), else the token's own `exp`, else 0 — and a session
 * whose token states no expiry is not one this app keeps.
 */
export const iamTokenExpiry = (account: {
  expires_at?: number | null;
  access_token?: string | null;
}): number => {
  if (typeof account.expires_at === "number" && account.expires_at > 0) {
    return account.expires_at * 1000;
  }
  return jwtExp(account.access_token) * 1000;
};

/** Whether a session still holds an unexpired IAM token. */
export const sessionLive = (token: IamBinding, now = Date.now()): boolean =>
  !!token.hanzoToken &&
  typeof token.hanzoTokenExpires === "number" &&
  token.hanzoTokenExpires > now;
