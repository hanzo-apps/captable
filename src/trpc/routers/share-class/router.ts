import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { createTRPCRouter, withAuth } from "@/trpc/api/trpc";
import { ShareClassMutationSchema } from "./schema";

/** The wire body a share class is created or amended with. */
const body = (input: Record<string, unknown>) => ({
  name: input.name,
  classType: input.classType,
  initialSharesAuthorized: input.initialSharesAuthorized,
  boardApprovalDate: (input.boardApprovalDate as Date).toISOString(),
  stockholderApprovalDate: (
    input.stockholderApprovalDate as Date
  ).toISOString(),
  votesPerShare: input.votesPerShare,
  parValue: input.parValue,
  pricePerShare: input.pricePerShare,
  seniority: input.seniority,
  conversionRights: input.conversionRights,
  convertsToShareClassId: input.convertsToShareClassId,
  liquidationPreferenceMultiple: input.liquidationPreferenceMultiple,
  participationCapMultiple: input.participationCapMultiple,
});

export const shareClassRouter = createTRPCRouter({
  create: withAuth
    .input(ShareClassMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { userAgent, requestIp, captable, db, session } = ctx;

      try {
        // The backend assigns `idx` and derives `prefix` from the class type;
        // both were computed here only because the row was written here.
        await captable.classes.add(body(input));

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "shareClass.created",
            companyId,
            actor: { type: "user", id: session.user.id },
            context: { userAgent, requestIp },
            target: [{ type: "company", id: companyId }],
            summary: `${session.user.name} created a share class - ${input.name}`,
          },
          db,
        );

        return { success: true, message: "Share class created successfully." };
      } catch (error) {
        console.error("Error creating shareClass:", error);
        return { success: false, message: captableFailure(error) };
      }
    }),

  update: withAuth
    .input(ShareClassMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { userAgent, requestIp, captable, db, session } = ctx;

      try {
        if (!input.id) throw new Error("share class id is required to update");
        await captable.classes.update(input.id, body(input));

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "shareClass.updated",
            companyId,
            actor: { type: "user", id: session.user.id },
            context: { userAgent, requestIp },
            target: [{ type: "company", id: companyId }],
            summary: `${session.user.name} updated a share class - ${input.name}`,
          },
          db,
        );

        return { success: true, message: "Share class updated successfully." };
      } catch (error) {
        console.error("Error updating shareClass:", error);
        return { success: false, message: captableFailure(error) };
      }
    }),

  get: withAuth.query(async ({ ctx }) => {
    const classes = await ctx.captable.classes.list();
    return classes.map(({ companyName, ...shareClass }) => ({
      ...shareClass,
      company: { name: companyName },
    }));
  }),
});
