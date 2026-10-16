import { generatePublicId } from "@/common/id";
import { cleanBlocks } from "@/lib/update-blocks";
import { Audit } from "@/server/audit";
import { withAccessControl } from "@/trpc/api/trpc";
import { UpdateMutationSchema } from "../schema";

export const cloneUpdateProcedure = withAccessControl
  .meta({ policies: { updates: { allow: ["create"] } } })
  .input(UpdateMutationSchema)
  .mutation(async ({ ctx, input }) => {
    try {
      const authorId = ctx.session.user.memberId;
      const companyId = ctx.session.user.companyId;
      const userId = ctx.session.user.id;
      const userName = ctx.session.user.name;
      const { userAgent, requestIp } = ctx;
      const publicId = generatePublicId();
      const { title } = input;
      // Every link and media address is made safe before the update is stored.
      const content = cleanBlocks(input.content);

      if (title.length === 0 || content.length === 0) {
        return {
          success: false,
          message: "Title and content cannot be empty.",
        };
      }
      await ctx.db.$transaction(async (tx) => {
        const update = await tx.update.create({
          data: {
            // An update is read from its blocks; no stored markup is ever shown.
            html: "",
            title: `Copy of - ${title}`,
            content,
            publicId,
            companyId,
            authorId,
          },
        });
        await Audit.create(
          {
            action: "update.cloned",
            companyId: companyId,
            actor: { type: "user", id: userId },
            context: {
              userAgent,
              requestIp,
            },
            target: [{ type: "update", id: update.id }],
            summary: `${userName} Cloned the Update ${title} for the company with id ${companyId}`,
          },
          tx,
        );
      });

      return {
        publicId,
        success: true,
        message: "Successfully cloned an update.",
      };
    } catch (error) {
      console.error("Error cloning an update:", error);
      return {
        success: false,
        message: "Oops, something went wrong. Please try again later.",
      };
    }
  });
