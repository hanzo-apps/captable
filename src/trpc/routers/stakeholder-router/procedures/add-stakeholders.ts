import { Audit } from "@/server/audit";
import { captableFailure } from "@/server/captable-api";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodAddStakeholderArrayMutationSchema } from "../schema";

export const addStakeholdersProcedure = withAccessControl
  .input(ZodAddStakeholderArrayMutationSchema)
  .meta({ policies: { stakeholder: { allow: ["create"] } } })
  .mutation(
    async ({
      ctx: { db, captable, membership, userAgent, requestIp, session },
      input,
    }) => {
      try {
        const { user } = session;

        await captable.stakeholders.add(input);

        for (const stakeholder of input) {
          await Audit.create(
            {
              action: "stakeholder.added",
              companyId: membership.companyId,
              actor: { type: "user", id: user.id },
              context: { userAgent, requestIp },
              target: [{ type: "stakeholder", id: stakeholder.email }],
              summary: `${user.name} added stakeholder ${stakeholder.name} for the company ID ${membership.companyId}`,
            },
            db,
          );
        }

        return { success: true, message: "Stakeholders added successfully!" };
      } catch (error) {
        console.error("Error adding stakeholders:", error);
        return { success: false, message: captableFailure(error) };
      }
    },
  );
