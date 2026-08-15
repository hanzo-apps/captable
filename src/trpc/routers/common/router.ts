import type { ShareContactType } from "@/schema/contacts";
import { createTRPCRouter, withAuth } from "@/trpc/api/trpc";

export const commonRouter = createTRPCRouter({
  getContacts: withAuth.query(async ({ ctx }) => {
    const { db, captable, session } = ctx;
    const user = session.user;
    const companyId = user.companyId;
    const contacts = [] as ShareContactType[];

    const [members, stakeholders] = await Promise.all([
      db.member.findMany({
        where: {
          companyId,
        },

        include: {
          user: {
            select: {
              email: true,
              name: true,
              image: true,
            },
          },
        },
      }),
      captable.stakeholders.list(),
    ]);
    (members || []).map((member) =>
      contacts.push({
        id: member.id,
        image: member.user.image ?? undefined,
        email: member.user.email ?? "",
        value: member.user.email ?? "",
        name: member.user.name ?? "",
        type: "member",
      }),
    );
    (stakeholders || []).map((stakeholder) =>
      contacts.push({
        id: stakeholder.id,
        email: stakeholder.email,
        value: stakeholder.email,
        name: stakeholder.name,
        institutionName: stakeholder.institutionName,
        type: "stakeholder",
      }),
    );

    return contacts;
  }),
});
