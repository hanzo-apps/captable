import { documentsBySecurity } from "@/server/captable-documents";
import { withAuth } from "@/trpc/api/trpc";

export const getSharesProcedure = withAuth.query(
  async ({ ctx: { db, captable } }) => {
    const shares = await captable.shares.list();
    const documents = await documentsBySecurity(
      db,
      "shareId",
      shares.map((share) => share.id),
    );

    const data = shares.map(
      ({ stakeholderName, shareClassName, shareClassType, ...share }) => ({
        ...share,
        // The table reads these as the joins Prisma used to return.
        stakeholder: { name: stakeholderName },
        shareClass: { name: shareClassName, classType: shareClassType },
        documents: documents.get(share.id) ?? [],
      }),
    );

    return { data };
  },
);
