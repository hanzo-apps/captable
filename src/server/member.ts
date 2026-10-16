import { createHash } from "@/lib/crypto";
import {
  isPlaceholder,
  parseMemberIdentifier,
  sameAddress,
} from "@/lib/invite";
import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { type TPrismaOrTransaction, db } from "./db";

/** The refusals a person meets on an invitation, in words they can act on. */
export const INVITE_INVALID =
  "This invitation is not valid, has expired, or has already been used. Ask a company admin to invite you again.";
export const INVITE_ADDRESS =
  "This invitation was sent to a different email address than the one Hanzo has verified for your account. Sign in with the account the invitation was sent to, or ask a company admin to invite this address.";
export const INVITE_ALREADY_MEMBER =
  "You are already a member of this company.";

export interface Invite {
  memberId: string;
  email: string;
}

/**
 * Resolves the seat a still-valid invitation token opens. Expired, unknown and
 * malformed tokens are one refusal, so a prober learns nothing about which
 * tokens exist.
 */
export async function resolveInvite(
  tx: TPrismaOrTransaction,
  token: string,
): Promise<Invite> {
  const invite = await tx.verificationToken.findFirst({ where: { token } });
  if (!invite || invite.expires.valueOf() <= Date.now()) {
    throw new TRPCError({ code: "NOT_FOUND", message: INVITE_INVALID });
  }
  const named = parseMemberIdentifier(invite.identifier);
  if (!named) {
    throw new TRPCError({ code: "NOT_FOUND", message: INVITE_INVALID });
  }
  return named;
}

/**
 * Whether the user may take the seat an invitation opens: IAM has proven the
 * address the invitation was sent to is this user's, the seat is still pending,
 * and it is held either by this user already or by the placeholder the
 * invitation made — a row with no sign-in, no address and no password, which
 * nobody can be. Returns the seat, or throws the refusal.
 */
export async function inviteSeat(
  tx: TPrismaOrTransaction,
  invite: Invite,
  userId: string,
) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user?.emailVerified || !sameAddress(user.email, invite.email)) {
    throw new TRPCError({ code: "FORBIDDEN", message: INVITE_ADDRESS });
  }

  const member = await tx.member.findFirst({
    where: { id: invite.memberId, status: "PENDING" },
    select: {
      id: true,
      companyId: true,
      userId: true,
      user: {
        select: {
          email: true,
          password: true,
          _count: { select: { accounts: true } },
        },
      },
    },
  });
  if (!member) {
    throw new TRPCError({ code: "NOT_FOUND", message: INVITE_INVALID });
  }
  if (member.userId === user.id) {
    return { member, placeholder: null };
  }
  if (!isPlaceholder(member.user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: INVITE_INVALID });
  }
  const held = await tx.member.findUnique({
    where: {
      companyId_userId: { companyId: member.companyId, userId: user.id },
    },
    select: { id: true },
  });
  if (held) {
    throw new TRPCError({ code: "CONFLICT", message: INVITE_ALREADY_MEMBER });
  }
  return { member, placeholder: member.userId };
}

/** An invitation is good for seven days from the mail that carries it. */
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function generateInviteToken() {
  const expires = new Date(Date.now() + INVITE_TTL_MS);

  const memberInviteTokenHash = await createHash(`member-${nanoid(32)}`);
  return { expires, memberInviteTokenHash };
}

/** Withdraws every invitation token that opens this member's seat. */
export async function revokeExistingInviteTokens({
  memberId,
  tx,
}: {
  memberId: string;
  tx?: TPrismaOrTransaction;
}) {
  const dbClient = tx ?? db;

  await dbClient.verificationToken.deleteMany({
    where: { identifier: { endsWith: `:${memberId}` } },
  });
}
