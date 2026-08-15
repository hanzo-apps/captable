import { withAccessControl } from "@/trpc/api/trpc";

export const getStakeholdersProcedure = withAccessControl
  .meta({ policies: { stakeholder: { allow: ["read"] } } })
  .query(async ({ ctx: { captable, membership } }) => {
    const stakeholders = await captable.stakeholders.list();

    return stakeholders.map(({ companyName, ...stakeholder }) => ({
      ...stakeholder,
      companyId: membership.companyId,
      // The pickers label a stakeholder with its company; the list route joins
      // the company and returns the name, so it needs no second read.
      company: { name: companyName },
    }));
  });
