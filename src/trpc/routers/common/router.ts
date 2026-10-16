import type { ShareContactType } from "@/schema/contacts";
import { createTRPCRouter, withAccessControl } from "@/trpc/api/trpc";

export const commonRouter = createTRPCRouter({
  // Everyone a data room or an update can be shared with: the company's members
  // and its stakeholders, so it needs the right to read both.
  getContacts: withAccessControl
    .meta({
      policies: {
        members: { allow: ["read"] },
        stakeholder: { allow: ["read"] },
      },
    })
    .query(async ({ ctx }) => {
      const { db, captable, membership } = ctx;
      const { companyId } = membership;
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
