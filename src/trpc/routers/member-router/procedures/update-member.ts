import { getRoleById } from "@/lib/rbac/access-control";
import { Audit } from "@/server/audit";
import { authorizeMemberChange } from "@/server/member";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodUpdateMemberMutationSchema } from "../schema";

export const updateMemberProcedure = withAccessControl
  .input(ZodUpdateMemberMutationSchema)
  .meta({
    policies: {
      members: { allow: ["update"] },
    },
  })
  .mutation(
    async ({
      ctx: { session, db, requestIp, userAgent, membership },
      input,
    }) => {
      const { memberId, name, roleId, ...rest } = input;
      const { companyId } = membership;
      const user = session.user;

      await db.$transaction(async (tx) => {
        // A role is touched only when the edit names one; an edit that says
        // nothing about it keeps the member's role as it is.
        const role =
          roleId === undefined
            ? undefined
            : await getRoleById({ tx, id: roleId, companyId });
        await authorizeMemberChange(tx, {
          caller: membership,
          companyId,
          memberId,
          change: role ? { role } : {},
        });

        const member = await tx.member.update({
          where: {
            status: "ACTIVE",
            id: memberId,
            companyId,
          },
          data: {
            ...rest,
            ...(role && {
              role: role.role,
              customRole: role.customRoleId
                ? { connect: { id: role.customRoleId } }
                : { disconnect: true },
            }),
            user: {
              update: {
                name,
              },
            },
          },
          select: {
            userId: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        });

        await Audit.create(
          {
            action: "member.updated",
            companyId: user.companyId,
            actor: { type: "user", id: user.id },
            context: {
              requestIp,
              userAgent,
            },
            target: [{ type: "user", id: member.userId }],
            summary: `${user.name} updated ${member.user?.name} details`,
          },
          tx,
        );
      });

      return { success: true };
    },
  );
