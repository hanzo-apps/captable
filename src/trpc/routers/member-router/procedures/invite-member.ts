import { sendMemberInviteEmailJob } from "@/jobs/member-inivite-email";
import { generateMemberIdentifier } from "@/lib/invite";
import { getRoleById } from "@/lib/rbac/access-control";
import { Audit } from "@/server/audit";
import {
  generateInviteToken,
  revokeExistingInviteTokens,
} from "@/server/member";
import { withAccessControl } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import { ZodInviteMemberMutationSchema } from "../schema";

export const inviteMemberProcedure = withAccessControl
  .input(ZodInviteMemberMutationSchema)
  .meta({
    policies: {
      members: { allow: ["create"] },
    },
  })
  .mutation(async ({ ctx, input }) => {
    const user = ctx.session.user;
    const { name, email, title, roleId } = input;
    const { userAgent, requestIp, membership } = ctx;
    const { companyId } = membership;

    const { expires, memberInviteTokenHash } = await generateInviteToken();
    const address = email.trim().toLowerCase();

    const { company, verificationToken } = await ctx.db.$transaction(
      async (tx) => {
        const company = await tx.company.findFirstOrThrow({
          where: {
            id: companyId,
          },
          select: {
            name: true,
            id: true,
          },
        });

        // An invitation seats a person who already signs in here only when IAM
        // has proven this address is theirs. Any other address is seated by a
        // placeholder — no sign-in, no address, no password — that whoever IAM
        // proves the address to takes over on accepting (inviteSeat). Seating a
        // row by its address alone would hand the seat to whoever registered
        // that address first.
        const known = await tx.user.findFirst({
          where: {
            email: address,
            emailVerified: { not: null },
            accounts: { some: {} },
          },
          select: { id: true },
        });

        const prevMember = known
          ? await tx.member.findUnique({
              where: {
                companyId_userId: { companyId, userId: known.id },
              },
            })
          : await tx.member.findFirst({
              where: { companyId, status: "PENDING", workEmail: address },
            });

        // if already a member, throw error
        if (prevMember && prevMember.status !== "PENDING") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "user already a member",
          });
        }

        const role = await getRoleById({ id: roleId, tx });
        // A role grants what its holder could already grant, so only an ADMIN
        // makes another ADMIN.
        if (role.role === "ADMIN" && membership.role !== "ADMIN") {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Only an admin can make another member an admin.",
          });
        }

        const seatHolder =
          prevMember?.userId ??
          known?.id ??
          (
            await tx.user.create({
              data: { name },
              select: { id: true },
            })
          ).id;

        //  create member
        const member = await tx.member.upsert({
          create: {
            title,
            isOnboarded: false,
            lastAccessed: new Date(),
            companyId,
            userId: seatHolder,
            status: "PENDING",
            workEmail: address,
            ...role,
          },
          update: {
            title,
            isOnboarded: false,
            lastAccessed: new Date(),
            status: "PENDING",
            workEmail: address,
            ...role,
          },
          where: {
            companyId_userId: {
              companyId,
              userId: seatHolder,
            },
          },
          select: {
            id: true,
            userId: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        });

        await revokeExistingInviteTokens({ memberId: member.id, tx });

        // custom verification token for member invitation
        const { token: verificationToken } = await tx.verificationToken.create({
          data: {
            identifier: generateMemberIdentifier({
              email: address,
              memberId: member.id,
            }),
            token: memberInviteTokenHash,
            expires,
          },
        });

        await Audit.create(
          {
            action: "member.invited",
            companyId: company.id,
            actor: { type: "user", id: user.id },
            context: {
              requestIp,
              userAgent,
            },
            target: [{ type: "user", id: member.userId }],
            summary: `${user.name} invited ${member.user?.name} to join ${company.name}`,
          },
          tx,
        );

        return { verificationToken, company };
      },
    );

    await sendMemberInviteEmailJob.emit({
      verificationToken,
      email: address,
      company,
      user: {
        email: user.email,
        name: user.name,
      },
    });

    return { success: true };
  });
