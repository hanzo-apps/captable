import { Audit } from "@/server/audit";
import { captableFailure } from "@/server/captable-api";
import { withAccessControl } from "@/trpc/api/trpc";
import { ZodUpdateStakeholderMutationSchema } from "./../schema";

export const updateStakeholderProcedure = withAccessControl
  .meta({ policies: { stakeholder: { allow: ["update"] } } })
  .input(ZodUpdateStakeholderMutationSchema)
  .mutation(
    async ({
      ctx: {
        session,
        db,
        captable,
        requestIp,
        userAgent,
        membership: { companyId },
      },
      input,
    }) => {
      try {
        const { id: stakeholderId, ...rest } = input;
        const user = session.user;

        if (!stakeholderId) throw new Error("stakeholder id is required");

        await captable.stakeholders.update(stakeholderId, rest);

        await Audit.create(
          {
            action: "stakeholder.updated",
            companyId,
            actor: { type: "user", id: user.id },
            context: { requestIp, userAgent },
            target: [{ type: "stakeholder", id: stakeholderId }],
            summary: `${user.name} updated detailes of stakeholder : ${
              rest.name ?? stakeholderId
            }`,
          },
          db,
        );

        return {
          success: true,
          message: "Successfully updated the stakeholder",
        };
      } catch (error) {
        console.error(error);
        return { success: false, message: captableFailure(error) };
      }
    },
  );
