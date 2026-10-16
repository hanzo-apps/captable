import { generatePublicId } from "@/common/id";
import { COMPANY_STANDS, companyStands } from "@/server/company";
import { createTRPCRouter, withAuth } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import { ZodOnboardingMutationSchema } from "./schema";

import { Audit } from "@/server/audit";

// HERE: Reusing this same router for new company, onboarding and edit company.
export const onboardingRouter = createTRPCRouter({
  // Founds the company, and only once: whoever signs in first after a fresh
  // install bootstraps it as its ADMIN; everyone after joins by invitation.
  onboard: withAuth
    .input(ZodOnboardingMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { userAgent, requestIp } = ctx;
      try {
        const { publicId } = await ctx.db.$transaction(async (tx) => {
          if (await companyStands(tx)) {
            throw new TRPCError({ code: "FORBIDDEN", message: COMPANY_STANDS });
          }
          const publicId = generatePublicId();

          const company = await tx.company.create({
            data: {
              ...input.company,
              incorporationDate: new Date(input.company.incorporationDate),
              publicId,
            },
          });

          // The address is IAM's and is never taken from this form: it is what
          // an invitation is matched against.
          const user = await tx.user.update({
            where: {
              id: ctx.session.user.id,
            },
            data: {
              name: `${input.user.name}`,
            },
            select: {
              id: true,
              name: true,
            },
          });

          await tx.member.create({
            data: {
              isOnboarded: true,
              status: "ACTIVE",
              title: input.user.title,
              userId: user.id,
              companyId: company.id,
              lastAccessed: new Date(),
            },
          });

          await Audit.create(
            {
              action: "user.onboarded",
              companyId: company.id,
              actor: { type: "user", id: user.id },
              context: {
                userAgent,
                requestIp,
              },
              target: [{ type: "company", id: company.id }],
              summary: `${user.name} onboarded ${company.name}`,
            },
            tx,
          );

          await Audit.create(
            {
              action: "company.created",
              companyId: company.id,
              actor: { type: "user", id: user.id },
              context: {
                userAgent,
                requestIp,
              },
              target: [{ type: "company", id: company.id }],
              summary: `${user.name} created company ${company.name}`,
            },
            tx,
          );

          return { publicId };
        });

        return { success: true, message: "successfully onboarded", publicId };
      } catch (error) {
        if (error instanceof TRPCError && error.message === COMPANY_STANDS) {
          return { success: false, message: COMPANY_STANDS };
        }
        console.error("Error onboarding:", error);
        return {
          success: false,
          message:
            "Oops, something went wrong while onboarding. Please try again.",
        };
      }
    }),
});
