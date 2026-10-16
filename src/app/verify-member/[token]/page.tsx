import EmptyState from "@/components/common/empty-state";
import { VerifyMemberForm } from "@/components/member/verify-member-form";
import { authOptions } from "@/server/auth";
import { db } from "@/server/db";
import { inviteSeat, resolveInvite } from "@/server/member";
import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Verify member",
};

/**
 * An invitation is opened by signing in with Hanzo as the person it was sent
 * to. The page checks the token and the seat the same way accepting does, so a
 * person who cannot take it is told why before filling anything in; accepting
 * checks again inside its own transaction.
 */
export default async function VerifyMember({
  params: { token },
}: {
  params: { token: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    const back = `/verify-member/${encodeURIComponent(token)}`;
    redirect(`/login?callbackUrl=${encodeURIComponent(back)}`);
  }

  try {
    const invite = await resolveInvite(db, token);
    await inviteSeat(db, invite, session.user.id);
  } catch (error) {
    if (error instanceof TRPCError) {
      return (
        <EmptyState
          title="This invitation cannot be accepted"
          subtitle={error.message}
          error={true}
        />
      );
    }
    throw error;
  }

  return <VerifyMemberForm token={token} />;
}
