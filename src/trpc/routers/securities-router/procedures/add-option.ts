import { generatePublicId } from "@/common/id";
import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodAddOptionMutationSchema } from "../schema";

export const addOptionProcedure = withAuth
  .input(ZodAddOptionMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const { userAgent, requestIp, captable, db, session } = ctx;
    const user = session.user;

    try {
      await captable.options.add({
        stakeholderId: input.stakeholderId,
        equityPlanId: input.equityPlanId,
        notes: input.notes,
        grantId: input.grantId,
        quantity: input.quantity,
        exercisePrice: input.exercisePrice,
        type: input.type,
        status: input.status,
        cliffYears: input.cliffYears,
        vestingYears: input.vestingYears,
        issueDate: input.issueDate,
        expirationDate: input.expirationDate,
        vestingStartDate: input.vestingStartDate,
        boardApprovalDate: input.boardApprovalDate,
        rule144Date: input.rule144Date,
      });

      const { companyId } = await checkMembership({ tx: db, session });

      if (input.documents.length > 0) {
        // The create answers with no body; the grant id is unique per company.
        const option = (await captable.options.list()).find(
          (o) => o.grantId === input.grantId,
        );

        await db.document.createMany({
          data: input.documents.map((doc) => ({
            companyId,
            uploaderId: user.memberId,
            publicId: generatePublicId(),
            name: doc.name,
            bucketId: doc.bucketId,
            optionId: option?.id ?? null,
          })),
          skipDuplicates: true,
        });
      }

      await Audit.create(
        {
          action: "option.created",
          companyId,
          actor: { type: "user", id: user.id },
          context: { userAgent, requestIp },
          target: [{ type: "company", id: companyId }],
          summary: `${user.name} added stock option for stakeholder ${input.stakeholderId}`,
        },
        db,
      );

      return { success: true, message: "🎉 Successfully added an option" };
    } catch (error) {
      console.error("Error adding options:", error);
      return { success: false, message: captableFailure(error) };
    }
  });
