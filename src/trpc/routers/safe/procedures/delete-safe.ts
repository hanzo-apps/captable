import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodDeleteSafesMutationSchema } from "../schema";

export const deleteSafeProcedure = withAuth
  .input(ZodDeleteSafesMutationSchema)
  .mutation(
    async ({ ctx: { db, captable, session, requestIp, userAgent }, input }) => {
      const user = session.user;
      const { safeId } = input;

      try {
        const safe = (await captable.safes.list()).find((s) => s.id === safeId);

        await captable.safes.remove(safeId);

        const { companyId } = await checkMembership({ tx: db, session });
        await Audit.create(
          {
            action: "safe.deleted",
            companyId,
            actor: { type: "user", id: user.id },
            context: { requestIp, userAgent },
            target: [{ type: "company", id: companyId }],
            summary: `${user.name} deleted safe agreement of stakholder ${
              safe?.stakeholderName ?? safeId
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
