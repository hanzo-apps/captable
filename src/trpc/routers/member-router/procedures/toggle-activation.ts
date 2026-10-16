import { Audit } from "@/server/audit";
import { authorizeMemberChange } from "@/server/member";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodToggleActivationMutationSchema } from "../schema";

export const toggleActivation = withAccessControl
  .input(ZodToggleActivationMutationSchema)
  .meta({ policies: { members: { allow: ["update"] } } })
  .mutation(
    async ({
      ctx: { session, db, requestIp, userAgent, membership },
      input,
    }) => {
      const user = session.user;
      const { memberId, status } = input;

      await db.$transaction(async (tx) => {
        const { companyId } = membership;

        await authorizeMemberChange(tx, {
          caller: membership,
          companyId,
          memberId,
          change: { status },
        });

        const member = await tx.member.update({
          where: {
            id: memberId,
            companyId,
          },
          data: {
            status,
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
            action: status ? "member.activated" : "member.deactivated",
            companyId,
            actor: { type: "user", id: user.id },
            context: {
              requestIp,
              userAgent,
            },
            target: [{ type: "user", id: member.userId }],
            summary: `${user.name} ${status ? "activated" : "deactivated"} ${
              member.user?.name
            } from ${member?.company.name}`,
          },
          tx,
        );
      });

      return { success: true };
    },
  );
