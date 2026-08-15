import { documentsBySecurity } from "@/server/captable-documents";
import { withAuth } from "@/trpc/api/trpc";

export const getOptionsProcedure = withAuth.query(
  async ({ ctx: { db, captable } }) => {
    const options = await captable.options.list();
    const documents = await documentsBySecurity(
      db,
      "optionId",
      options.map((option) => option.id),
    );

    const data = options.map(
      ({ stakeholderName, equityPlanName, ...option }) => ({
        ...option,
        stakeholder: { name: stakeholderName },
        equityPlan: { name: equityPlanName },
        documents: documents.get(option.id) ?? [],
      }),
    );

    return { data };
  },
);
