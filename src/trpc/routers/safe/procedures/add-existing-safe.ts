import { generatePublicId } from "@/common/id";
import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { ZodAddExistingSafeMutationSchema } from "../schema";
import { safeBody } from "../wire";

export const addExistingSafeProcedure = withAuth
  .input(ZodAddExistingSafeMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const { userAgent, requestIp, captable, db, session } = ctx;
    const user = session.user;
    const { documents, ...rest } = input;

    try {
      const publicId = generatePublicId();
      await captable.safes.add(safeBody(publicId, rest));

      const { companyId, memberId } = await checkMembership({
        tx: db,
        session,
      });

      if (documents.length > 0) {
        // The create answers with no body; the public id is unique per company.
        const safe = (await captable.safes.list()).find(
          (s) => s.publicId === publicId,
        );

        await db.document.createMany({
          data: documents.map((doc) => ({
            companyId,
            uploaderId: memberId,
            publicId: generatePublicId(),
            name: doc.name,
            bucketId: doc.bucketId,
            safeId: safe?.id ?? null,
          })),
          skipDuplicates: true,
        });
      }

      await Audit.create(
        {
          action: "safe.imported",
          companyId,
          actor: { type: "user", id: user.id },
          context: { userAgent, requestIp },
          target: [{ type: "company", id: companyId }],
          summary: `${user.name} imported existing SAFEs.`,
        },
        db,
      );

      return { success: true, message: "SAFEs imported for the stakeholder." };
    } catch (error) {
      console.error("Error adding existing SAFEs:", error);
      return { success: false, message: captableFailure(error) };
    }
  });
