import { Audit } from "@/server/audit";
import { revokeExistingInviteTokens } from "@/server/member";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodRevokeInviteMutationSchema } from "../schema";
import { removeMemberHandler } from "./remove-member";

export const revokeInviteProcedure = withAccessControl
  .input(ZodRevokeInviteMutationSchema)
  .meta({ policies: { members: { allow: ["delete"] } } })
  .mutation(async ({ ctx, input }) => {
    const { db, session, requestIp, userAgent, membership } = ctx;
    const user = session.user;
    const { memberId } = input;

    await db.$transaction(async (tx) => {
      const member = await tx.member.findFirstOrThrow({
        where: {
          id: memberId,
          companyId: membership.companyId,
          status: "PENDING",
        },
        select: {
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
          company: {
            select: {
              name: true,
            },
          },
        },
      });

      await Audit.create(
        {
          action: "member.revoked-invite",
          companyId: membership.companyId,
          actor: { type: "user", id: user.id },
          context: {
            requestIp,
            userAgent,
          },
          target: [{ type: "user", id: member?.userId }],
          summary: `${user.name} revoked ${member?.user?.name} to join ${member?.company?.name}`,
        },
        tx,
      );

      await revokeExistingInviteTokens({ memberId, tx });

      await removeMemberHandler({
        ctx: { ...ctx, db: tx },
        input: { memberId: input.memberId },
      });
    });

    return { success: true };
  });
