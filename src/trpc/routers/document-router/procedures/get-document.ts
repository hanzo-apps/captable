import { companyObjectUrl } from "@/server/bucket";
import { withAccessControl, withAuth } from "@/trpc/api/trpc";
import { ZodGetDocumentQuerySchema } from "../schema";

export const getDocumentProcedure = withAccessControl
  .input(ZodGetDocumentQuerySchema)
  .meta({ policies: { documents: { allow: ["read"] } } })
  .query(
    async ({
      ctx: {
        db,
        membership: { companyId },
      },
      input,
    }) => {
      const data = await db.document.findFirstOrThrow({
        where: {
          publicId: input.publicId,
          companyId,
        },
        select: {
          bucket: {
            select: {
              key: true,
            },
          },
        },
      });

      return companyObjectUrl(db, companyId, data.bucket.key);
    },
  );
