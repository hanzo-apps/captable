import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodDeleteShareMutationSchema } from "../schema";

export const deleteShareProcedure = withAuth
  .input(ZodDeleteShareMutationSchema)
  .mutation(
    async ({ ctx: { db, captable, session, requestIp, userAgent }, input }) => {
      const user = session.user;
      const { shareId } = input;

      try {
        // Read the row first so the audit entry still names the stakeholder it
        // belonged to — a delete answers with no body to name them from.
        const share = (await captable.shares.list()).find(
          (s) => s.id === shareId,
        );

        await captable.shares.remove(shareId);

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "share.deleted",
            companyId,
            actor: { type: "user", id: user.id },
            context: { requestIp, userAgent },
            target: [{ type: "share", id: shareId }],
            summary: `${user.name} deleted share of stakholder ${
              share?.stakeholderName ?? shareId
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
