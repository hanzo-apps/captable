import { generatePublicId } from "@/common/id";
import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodAddShareMutationSchema } from "../schema";

export const addShareProcedure = withAuth
  .input(ZodAddShareMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const { userAgent, requestIp, captable, db, session } = ctx;
    const user = session.user;

    try {
      await captable.shares.add({
        stakeholderId: input.stakeholderId,
        shareClassId: input.shareClassId,
        status: input.status,
        certificateId: input.certificateId,
        quantity: input.quantity,
        pricePerShare: input.pricePerShare,
        capitalContribution: input.capitalContribution,
        ipContribution: input.ipContribution,
        debtCancelled: input.debtCancelled,
        otherContributions: input.otherContributions,
        cliffYears: input.cliffYears,
        vestingYears: input.vestingYears,
        companyLegends: input.companyLegends,
        issueDate: input.issueDate,
        rule144Date: input.rule144Date,
        vestingStartDate: input.vestingStartDate,
        boardApprovalDate: input.boardApprovalDate,
      });

      const { companyId } = await checkMembership({ tx: db, session });

      if (input.documents.length > 0) {
        // The create answers with no body, so the new row is found by the
        // certificate id — which the backend enforces unique per company.
        const share = (await captable.shares.list()).find(
          (s) => s.certificateId === input.certificateId,
        );

        await db.document.createMany({
          data: input.documents.map((doc) => ({
            companyId,
            uploaderId: user.memberId,
            publicId: generatePublicId(),
            name: doc.name,
            bucketId: doc.bucketId,
            shareId: share?.id ?? null,
          })),
          skipDuplicates: true,
        });
      }

      await Audit.create(
        {
          action: "share.created",
          companyId,
          actor: { type: "user", id: user.id },
          context: { userAgent, requestIp },
          target: [{ type: "share", id: input.certificateId }],
          summary: `${user.name} added share for stakeholder ${input.stakeholderId}`,
        },
        db,
      );

      return { success: true, message: "🎉 Successfully added a share" };
    } catch (error) {
      console.error("Error adding shares: ", error);
      return { success: false, message: captableFailure(error) };
    }
  });
