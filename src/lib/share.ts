/**
 * Whether a share link's recipient may still open what it names. A recipient
 * who is one of the company's members opens it only while still an ACTIVE
 * member; anyone else holds it until it is unshared or the link expires.
 */
export const recipientMayOpen = (recipient: {
  memberId: string | null;
  member: { status: string } | null;
}): boolean =>
  recipient.memberId === null || recipient.member?.status === "ACTIVE";
