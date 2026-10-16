import { Audit } from "@/server/audit";
import type { TPrismaOrTransaction } from "@/server/db";
import {
  withAccessControl,
  type withAccessControlTrpcContextType,
} from "@/trpc/api/trpc";
import {
  type TypeZodRemoveMemberMutationSchema,
  ZodRemoveMemberMutationSchema,
} from "../schema";

export const removeMemberProcedure = withAccessControl
  .input(ZodRemoveMemberMutationSchema)
  .meta({ policies: { members: { allow: ["delete"] } } })
  .mutation(async (args) => {
    const data = await args.ctx.db.$transaction(async (db) => {
      const data = await removeMemberHandler({
        ...args,
        ctx: { ...args.ctx, db },
      });

      return data;
    });

    return data;
  });

interface removeMemberHandlerOptions {
  input: TypeZodRemoveMemberMutationSchema;
  ctx: Omit<Awaited<withAccessControlTrpcContextType>, "db"> & {
    db: TPrismaOrTransaction;
  };
}

export async function removeMemberHandler({
  ctx: { db, session, requestIp, userAgent, membership },
  input,
}: removeMemberHandlerOptions) {
  const user = session.user;
  const { memberId } = input;
  const { companyId } = membership;

  const member = await db.member.delete({
    where: {
      id: memberId,
      companyId,
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
      action: "member.removed",
      companyId,
      actor: { type: "user", id: user.id },
      context: {
        requestIp,
        userAgent,
      },
      target: [{ type: "user", id: member.userId }],
      summary: `${user.name} removed ${member.user?.name} from ${member?.company?.name}`,
    },
    db,
  );

  return { success: true };
}
