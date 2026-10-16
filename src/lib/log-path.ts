/** The routes whose next path segment is a secret: an invitation, a signing link. */
const SECRET_AFTER = new Set(["verify-member", "esign"]);

/**
 * The part of a request path a log may keep: the path alone — a query carries
 * share tokens and tRPC inputs — with every secret segment replaced.
 */
export const loggedPath = (pathname: string): string => {
  const parts = pathname.split("/");
  return parts
    .map((part, i) =>
      i > 0 && SECRET_AFTER.has(parts[i - 1] ?? "") && part ? ":token" : part,
    )
    .join("/");
};
