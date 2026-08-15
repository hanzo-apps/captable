import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodDeleteOptionMutationSchema } from "../schema";

export const deleteOptionProcedure = withAuth
  .input(ZodDeleteOptionMutationSchema)
  .mutation(
    async ({ ctx: { db, captable, session, requestIp, userAgent }, input }) => {
      const user = session.user;
      const { optionId } = input;

      try {
        const option = (await captable.options.list()).find(
          (o) => o.id === optionId,
        );

        await captable.options.remove(optionId);

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "option.deleted",
            companyId,
            actor: { type: "user", id: user.id },
            context: { requestIp, userAgent },
            target: [{ type: "option", id: optionId }],
            summary: `${user.name} deleted stock option of stakholder ${
              option?.stakeholderName ?? optionId
            }`,
          },
          db,
        );

        return { success: true };
      } catch (error) {
        console.error(error);
        return { success: false, message: captableFailure(error) };
      }
    },
  );
