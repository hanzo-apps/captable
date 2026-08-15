import { documentsBySecurity } from "@/server/captable-documents";
import { withAuth } from "@/trpc/api/trpc";

export const getSafesProcedure = withAuth.query(
  async ({ ctx: { db, captable } }) => {
    const safes = await captable.safes.list();
    const documents = await documentsBySecurity(
      db,
      "safeId",
      safes.map((safe) => safe.id),
    );

    const data = safes.map(({ stakeholderName, ...safe }) => ({
      ...safe,
      stakeholder: { name: stakeholderName },
      documents: documents.get(safe.id) ?? [],
    }));

    return { data };
  },
);
