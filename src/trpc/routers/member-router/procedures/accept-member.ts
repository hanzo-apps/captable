import { Audit } from "@/server/audit";
import {
  INVITE_INVALID,
  inviteSeat,
  resolveInvite,
  revokeExistingInviteTokens,
} from "@/server/member";
import { withAuth } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import { ZodAcceptMemberMutationSchema } from "../schema";

/**
 * Takes the seat an invitation opens, for the signed-in user. The seat is the
 * one the token names — the caller sends the token and nothing that says which
 * member it is — and it is taken only by the person IAM has proven the invited
 * address belongs to (inviteSeat). The token is spent in the same transaction,
 * with every other token for that seat, so an invitation opens one seat once.
 */
export const acceptMemberProcedure = withAuth
  .input(ZodAcceptMemberMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const user = ctx.session.user;
    const { userAgent, requestIp } = ctx;

    const { publicId } = await ctx.db.$transaction(async (trx) => {
      const invite = await resolveInvite(trx, input.token);
      const { member: seat, placeholder } = await inviteSeat(
        trx,
        invite,
        user.id,
      );

      await revokeExistingInviteTokens({ memberId: seat.id, tx: trx });

      await trx.user.update({
        where: {
          id: user.id,
        },
        data: {
          name: input.name,
        },
      });

      // Taken only while still pending and held as inviteSeat saw it, so two
      // accepts racing on one token cannot both land.
      const taken = await trx.member.updateMany({
        where: { id: seat.id, status: "PENDING", userId: seat.userId },
        data: {
          status: "ACTIVE",
          lastAccessed: new Date(),
          isOnboarded: true,
          userId: user.id,
          workEmail: input.workEmail,
        },
      });
      if (taken.count !== 1) {
        throw new TRPCError({ code: "NOT_FOUND", message: INVITE_INVALID });
      }

      const member = await trx.member.findUniqueOrThrow({
        where: {
          id: seat.id,
        },
        select: {
          company: {
            select: {
              publicId: true,
              name: true,
              id: true,
            },
          },
          userId: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      });

      // The stand-in the invitation seated holds nothing once the seat is taken.
      if (placeholder) {
        await trx.user.deleteMany({
          where: { id: placeholder, memberships: { none: {} } },
        });
      }

      await Audit.create(
        {
          action: "member.accepted",
          companyId: member.company.id,
          actor: { type: "user", id: user.id },
          context: {
            requestIp,
            userAgent,
          },
          target: [{ type: "user", id: member.userId }],
          summary: `${member?.user?.name} joined ${member.company.name}`,
        },
        trx,
      );

      return { publicId: member.company.publicId };
    });

    return { success: true, publicId };
  });
