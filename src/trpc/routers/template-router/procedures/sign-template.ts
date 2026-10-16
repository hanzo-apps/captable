import { EsignService } from "@/services/esign-service";
import { withoutAuth } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import { UAParser } from "ua-parser-js";
import { DecodeEmailToken } from "../../template-field-router/procedures/add-fields";
import { SignTemplateMutationSchema } from "../schema";

/**
 * Signs as the recipient the signing link names. The link's token is the only
 * credential a signer has, so the template and the recipient are read from it,
 * never from the request; the recipient must still be waiting to sign, and it
 * fills only the fields that are its own.
 */
export const signTemplateProcedure = withoutAuth
  .input(SignTemplateMutationSchema)
  .mutation(async ({ ctx, input }) => {
    const { db, requestIp, userAgent } = ctx;

    const signing = await DecodeEmailToken(input.token).catch(() => null);
    if (!signing) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "This signing link is not valid or has expired.",
      });
    }
    const { id: templateId, rec: recipientId } = signing;

    const userAgentParser = new UAParser(userAgent);
    const userAgentResult = userAgentParser.getResult();
    const browser = userAgentResult.browser.name;

    const eSignService = new EsignService();

    await db.$transaction(async (tx) => {
      const waiting = await tx.esignRecipient.findFirst({
        where: {
          id: recipientId,
          templateId,
          status: "SENT",
          template: { status: "PENDING" },
        },
        select: { id: true },
      });
      if (!waiting) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This document is not waiting for your signature.",
        });
      }

      const template = await eSignService.getTemplate(templateId, tx);

      const bucketKey = template.bucket.key;
      const companyId = template.companyId;
      const templateName = template.name;
      const sender = template.uploader.user;
      const allRecipients = new Set(
        template.fields.map((item) => item.recipientId),
      );
      const isMultiRecipient = allRecipients.size > 1;
      const isOrderedDelivery = template.orderedDelivery;

      const recipient = await eSignService.getRecipient(
        recipientId,
        template.id,
        tx,
      );

      // A signer's values reach its own fields and no one else's.
      const data = Object.fromEntries(
        template.fields
          .filter((field) => field.recipientId === recipient.id)
          .flatMap((field) =>
            field.id in input.data ? [[field.id, input.data[field.id]]] : [],
          ),
      ) as Record<string, string>;

      await eSignService.updateRecipientStatus(recipient.id, "SIGNED", tx);

      await eSignService.createSignedAuditLog(
        {
          browser,
          companyId,
          recipientId: recipient.id,
          templateId: template.id,
          ip: ctx.requestIp,
          location: "",
          userAgent: ctx.userAgent,
          templateName: template.name,
          recipientName: recipient.name,
        },
        tx,
      );

      if (!isMultiRecipient) {
        await eSignService.completeDocument({
          companyId,
          templateName,
          fields: template.fields,
          data,
          templateId: template.id,
          requestIp,
          userAgent,
          sender,
          recipients: [
            {
              email: recipient.email,
              name: recipient.name,
            },
          ],
          company: template.company,
          bucketKey,
        });
      }

      if (isMultiRecipient) {
        await eSignService.saveFieldValues(template.fields, data, tx);

        const allRecipients = await eSignService.getAllRecipients(
          template.id,
          tx,
        );
        const areAllRecipientsSigned = allRecipients.every(
          (recipient) => recipient.status === "SIGNED",
        );

        if (areAllRecipientsSigned) {
          const fieldValues = await eSignService.getFieldValues(
            template.id,
            tx,
          );

          await eSignService.completeDocument({
            bucketKey,
            companyId,
            templateName,
            fields: template.fields,
            data: fieldValues,
            templateId: template.id,
            requestIp,
            userAgent,
            company: template.company,
            recipients: allRecipients.map((item) => ({
              email: item.email,
              name: item.name,
            })),
            sender,
          });
        }
      }

      if (isOrderedDelivery) {
        await eSignService.handleOrderedDelivery(
          template,
          { sender, requestIp, userAgent },
          tx,
        );
      }
    });

    return {};
  });
