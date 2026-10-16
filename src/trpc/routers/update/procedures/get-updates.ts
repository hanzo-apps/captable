import { withAccessControl } from "@/trpc/api/trpc";
import { z } from "zod";

export const getUpdatesProcedure = withAccessControl
  .meta({ policies: { updates: { allow: ["read"] } } })
  .query(async ({ ctx }) => {
    const {
      db,
      session: { user },
    } = ctx;

    const data = await db.update.findMany({
      where: {
        companyId: user.companyId,
      },
      include: {
        recipients: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { data };
  });

export const getRecipientsProcedure = withAccessControl
  .meta({ policies: { updates: { allow: ["read"] } } })
  .input(z.object({ updateId: z.string() }))
  .query(async ({ ctx, input }) => {
    const {
      db,
      session: { user },
    } = ctx;

    const { updateId } = input;
    const { companyId } = user;

    const data = await db.updateRecipient.findMany({
      where: {
        update: {
          id: updateId,
          companyId: companyId,
        },
      },
    });

    // Who it is shared with, never their links: a link is minted only where
    // it is mailed (share), so reading an update hands out no access.
    return data;
  });
