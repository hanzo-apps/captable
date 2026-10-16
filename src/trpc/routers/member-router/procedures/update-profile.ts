import { PayloadType } from "@/lib/constants";
import { Audit } from "@/server/audit";
import { withAuth } from "@/trpc/api/trpc";
import { ZodUpdateProfileMutationSchema } from "../schema";

export const updateProfileProcedure = withAuth
  .input(ZodUpdateProfileMutationSchema)
  .mutation(async ({ ctx: { session, db, requestIp, userAgent }, input }) => {
    const user = session.user;

    if (input.type === PayloadType.PROFILE_DATA) {
      // The sign-in address is IAM's — it is what an invitation is matched
      // against — so a profile edit never changes it.
      const { fullName, workEmail, jobTitle } = input.payload;

      await db.$transaction(async (tx) => {
        const member = await tx.member.update({
          where: {
            status: "ACTIVE",
            id: user.memberId,
            companyId: user.companyId,
          },
          data: {
            title: jobTitle,
            workEmail,
            user: {
              update: {
                name: fullName,
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
            summary: `${user.name} updated the profile information.`,
          },
          tx,
        );
      });

      return { success: true };
    }

    if (input.type === PayloadType.PROFILE_AVATAR) {
      const { avatarUrl } = input.payload;

      await db.$transaction(async (tx) => {
        const member = await tx.member.update({
          where: {
            status: "ACTIVE",
            id: user.memberId,
            companyId: user.companyId,
          },
          data: {
            user: {
              update: {
                image: avatarUrl,
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
            summary: `${user.name} uploaded new profile image.`,
          },
          tx,
        );
      });

      return { success: true };
    }
  });
