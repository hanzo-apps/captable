import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { createTRPCRouter, withAuth } from "@/trpc/api/trpc";
import { EquityPlanMutationSchema } from "./schema";

/** The wire body an equity plan is created with. */
const body = (input: Record<string, unknown>) => ({
  name: input.name,
  boardApprovalDate: (input.boardApprovalDate as Date).toISOString(),
  planEffectiveDate: input.planEffectiveDate
    ? (input.planEffectiveDate as Date).toISOString()
    : null,
  initialSharesReserved: input.initialSharesReserved,
  shareClassId: input.shareClassId,
  defaultCancellatonBehavior: input.defaultCancellatonBehavior,
  comments: input.comments,
});

export const equityPlanRouter = createTRPCRouter({
  getPlans: withAuth.query(async ({ ctx }) => ({
    data: await ctx.captable.plans.list(),
  })),

  create: withAuth
    .input(EquityPlanMutationSchema)
    .mutation(async ({ ctx, input }) => {
      const { userAgent, requestIp, captable, db, session } = ctx;

      try {
        await captable.plans.add(body(input));

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "equityPlan.created",
            companyId,
            actor: { type: "user", id: session.user.id },
            context: { requestIp, userAgent },
            target: [{ type: "company", id: companyId }],
            summary: `${session.user.name} created an equity plan - ${input.name}`,
          },
          db,
        );

        return { success: true, message: "Equity plan created successfully." };
      } catch (error) {
        console.error("Error creating an equity plan:", error);
        return { success: false, message: captableFailure(error) };
      }
    }),

  // The cap-table backend serves GET and POST on /v1/captable/plans and nothing
  // on /v1/captable/plans/{id} — measured, PUT/PATCH/POST all 404 there while
  // the sibling classes route answers PATCH. Amending a plan needs
  // `PATCH /v1/captable/plans/{id}`.
  update: withAuth.input(EquityPlanMutationSchema).mutation(({ input }) => {
    console.error("equityPlan.update: no upstream route", { id: input.id });
    return {
      success: false,
      message:
        "Editing an equity plan is not available yet. Hanzo Cloud serves no update route for plans.",
    };
  }),
});
