import { sendMemberInviteEmailJob } from "@/jobs/member-inivite-email";
import { generateMemberIdentifier, isPlaceholder } from "@/lib/invite";
import { Audit } from "@/server/audit";
import {
  generateInviteToken,
  revokeExistingInviteTokens,
} from "@/server/member";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodReInviteMutationSchema } from "../schema";

export const reInviteProcedure = withAccessControl
  .input(ZodReInviteMutationSchema)
  .meta({ policies: { members: { allow: ["create"] } } })
  .mutation(
    async ({
      ctx: { session, db, requestIp, userAgent, membership },
      input,
    }) => {
      const user = session.user;
      const { companyId } = membership;

      const { expires, memberInviteTokenHash } = await generateInviteToken();

      const { company, verificationToken, email } = await db.$transaction(
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

          const member = await tx.member.findFirstOrThrow({
            where: {
              id: input.memberId,
              status: "PENDING",
              companyId,
            },

            include: {
              user: {
                select: {
                  name: true,
                  email: true,
                  password: true,
                  _count: { select: { accounts: true } },
                },
              },
            },
          });

          const email = (member.workEmail ?? member.user.email)
            ?.trim()
            .toLowerCase();

          if (!email) {
            throw new Error("invited email not found");
          }

          // A seat an earlier invitation filled with a stand-in that carries
          // the address is moved to the form the invitation now takes: the
          // address on the seat, none on the stand-in, so the stand-in can
          // never be mistaken for the person at that address.
          if (
            member.user.email &&
            isPlaceholder({ ...member.user, email: null })
          ) {
            await tx.user.update({
              where: { id: member.userId },
              data: { email: null },
            });
          }
          if (member.workEmail !== email) {
            await tx.member.update({
              where: { id: member.id },
              data: { workEmail: email },
            });
          }

          await revokeExistingInviteTokens({
            memberId: member.id,
            tx,
          });

          // custom verification token for member invitation
          const { token: verificationToken } =
            await tx.verificationToken.create({
              data: {
                identifier: generateMemberIdentifier({
                  email,
                  memberId: member.id,
                }),
                token: memberInviteTokenHash,
                expires,
              },
            });

          await Audit.create(
            {
              action: "member.re-invited",
              companyId: company.id,
              actor: { type: "user", id: user.id },
              context: {
                requestIp,
                userAgent,
              },
              target: [{ type: "user", id: member.userId }],
              summary: `${user.name} reinvited ${member.user?.name} to join ${company.name}`,
            },
            tx,
          );

          return { verificationToken, company, email };
        },
      );

      await sendMemberInviteEmailJob.emit({
        verificationToken,
        email,
        company,
        user: {
          email: user.email,
          name: user.name,
        },
      });

      return { success: true };
    },
  );
