import fs from "node:fs";
import path from "node:path";
import { generatePublicId } from "@/common/id";
import { uploadFile } from "@/common/uploads";
import { invariant } from "@/lib/error";
import { TAG } from "@/lib/tags";
import { Audit } from "@/server/audit";
import { checkMembership } from "@/server/auth";
import { captableFailure } from "@/server/captable-api";
import { withAuth } from "@/trpc/api/trpc";
import { createBucketHandler } from "../../bucket-router/procedures/create-bucket";
import { createTemplateHandler } from "../../template-router/procedures/create-template";
import { ZodCreateSafeMutationSchema } from "../schema";
import { safeBody } from "../wire";

export const createSafeProcedure = withAuth
  .input(ZodCreateSafeMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const { userAgent, requestIp, session, captable, db } = ctx;
    const user = session.user;
    const safeTemplate = input.safeTemplate;

    const { orderedDelivery, recipients, ...inputRest } = input;

    try {
      // The SAFE lands upstream first. The bucket, template and audit below are
      // this app's own rows, so a refusal up there leaves nothing behind here.
      await captable.safes.add(safeBody(generatePublicId(), inputRest));

      let uploadData: Awaited<ReturnType<typeof uploadFile>> | null = null;
      let document: { name: string; bucketId: string } | null = null;

      if (input.safeTemplate !== "CUSTOM") {
        const pdfPath = path.join(
          process.cwd(),
          "public",
          "yc",
          `${safeTemplate}.pdf`,
        );
        const pdfBuffer = fs.readFileSync(pdfPath);

        const file = {
          name: safeTemplate,
          type: "application/pdf",
          arrayBuffer: async () => Promise.resolve(pdfBuffer),
          size: pdfBuffer.byteLength,
        } as unknown as File;

        uploadData = await uploadFile(
          file,
          { identifier: "templates", keyPrefix: "new-safes" },
          "privateBucket",
        );
      }

      const { template } = await db.$transaction(async (tx) => {
        const { companyId, memberId } = await checkMembership({ session, tx });

        if (uploadData) {
          const { fileUrl: _fileUrl, ...rest } = uploadData;
          const { name: bucketName, id: bucketId } = await createBucketHandler({
            db: tx,
            input: { ...rest, tags: [TAG.SAFE] },
            userAgent,
            requestIp,
            user: {
              companyId: user.companyId,
              id: user.id,
              name: user.name || "",
            },
          });

          document = { name: bucketName, bucketId };
        }

        if (input.safeTemplate === "CUSTOM") {
          document = input.document;
        }

        invariant(document, "document not found");

        const partialUser = {
          name: user.name || "",
          id: user.id,
          companyId: user.companyId,
        };
        const template = await createTemplateHandler({
          ctx: { db: tx, userAgent, requestIp, user: partialUser },
          input: {
            ...document,
            uploaderId: memberId,
            companyId,
            orderedDelivery,
            recipients,
          },
        });

        await Audit.create(
          {
            action: "safe.created",
            companyId,
            actor: { type: "user", id: user.id },
            context: { requestIp, userAgent },
            target: [{ type: "company", id: companyId }],
            summary: `${user.name} created a new SAFE agreement with YC template.`,
          },
          tx,
        );

        return { template };
      });

      return {
        success: true as const,
        message: "Created SAFEs agreement with custom template.",
        template,
      };
    } catch (error) {
      console.error("Error creating safe:", error);
      return { success: false as const, message: captableFailure(error) };
    }
  });
