// The pure half of an invitation: how its token row names the seat it opens and
// the address it was sent to, and what a stand-in seat holder looks like.
//
// An invitation is a VerificationToken whose identifier is
// `<invited address>:<member id>` and whose token is the secret the mail carries.

/** Whether two addresses are the same mailbox, as this app stores them. */
export const sameAddress = (a: string | null | undefined, b: string) =>
  !!a && !!b.trim() && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The identifier an invitation token is filed under. */
export const generateMemberIdentifier = ({
  email,
  memberId,
}: {
  email: string;
  memberId: string;
}) => `${email.trim().toLowerCase()}:${memberId}`;

/**
 * The address and member an identifier names, or null when it names none. The
 * member id is a cuid, so it is everything after the last colon.
 */
export const parseMemberIdentifier = (identifier: string) => {
  const at = identifier.lastIndexOf(":");
  const email = at > 0 ? identifier.slice(0, at) : "";
  const memberId = at > 0 ? identifier.slice(at + 1) : "";
  return email && memberId ? { email, memberId } : null;
};

/** A user row nobody can sign in as: the stand-in an invitation seats. */
export const isPlaceholder = (user: {
  email: string | null;
  password: string | null;
  _count: { accounts: number };
}) => !user.email && !user.password && user._count.accounts === 0;
