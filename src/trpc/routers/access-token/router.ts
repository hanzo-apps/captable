import { createSecureHash, initializeAccessToken } from "@/lib/crypto";
import { AccessTokenType } from "@/prisma/enums";
import { Audit } from "@/server/audit";

import { createTRPCRouter, withAccessControl } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import z from "zod";

/** How long an API access token lives. */
const ACCESS_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

export const accessTokenRouter = createTRPCRouter({
  listAll: withAccessControl
    .meta({ policies: { developer: { allow: ["read"] } } })
    .input(z.object({ typeEnum: z.nativeEnum(AccessTokenType) }))
    .query(async ({ ctx, input }) => {
      const {
        db,
        membership: { userId },
      } = ctx;

      const { typeEnum } = input;

      const accessTokens = await db.accessToken.findMany({
        where: {
          active: true,
          userId,
          typeEnum,
        },

        orderBy: {
          createdAt: "desc",
        },

        select: {
          id: true,
          clientId: true,
          createdAt: true,
          lastUsed: true,
        },
      });

      return {
        accessTokens,
      };
    }),

  create: withAccessControl
    .meta({ policies: { developer: { allow: ["create"] } } })
    .input(z.object({ typeEnum: z.nativeEnum(AccessTokenType) }))
    .mutation(async ({ ctx, input }) => {
      const {
        db,
        membership: { userId, companyId },
        userAgent,
        requestIp,
        session,
      } = ctx;

      const { typeEnum } = input;

      const { clientId, clientSecret } = initializeAccessToken({
        prefix: typeEnum,
      });

      const user = session.user;
      const hashedClientSecret = await createSecureHash(clientSecret);

      const key = await db.accessToken.create({
        data: {
          userId,
          typeEnum,
          clientId,
          clientSecret: hashedClientSecret,
          // A token stops working after ninety days; a new one is made here.
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
        },
      });

      await Audit.create(
        {
          action: "accessToken.created",
          companyId,
          actor: { type: "user", id: user.id },
          context: {
            userAgent,
            requestIp,
          },
          target: [{ type: "accessToken", id: key.id }],
          summary: `${user.name} created an access token - ${clientId}`,
        },
        db,
      );

      return {
        token: `${clientId}:${clientSecret}`,
        partialKey: clientId,
        createdAt: key.createdAt,
      };
    }),

  delete: withAccessControl
    .meta({ policies: { developer: { allow: ["delete"] } } })
    .input(z.object({ tokenId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const {
        db,
        membership: { userId, companyId },
        session,
        requestIp,
        userAgent,
      } = ctx;
      const { tokenId } = input;
      const { user } = session;
      try {
        const key = await db.accessToken.delete({
          where: {
            id: tokenId,
            userId,
          },
        });

        await Audit.create(
          {
            action: "accessToken.deleted",
            companyId,
            actor: { type: "user", id: user.id },
            context: {
              userAgent,
              requestIp,
            },
            target: [{ type: "accessToken", id: key.id }],
            summary: `${user.name} deleted an access token - ${key.clientId}`,
          },
          db,
        );

        return {
          success: true,
          message: "Key deleted Successfully.",
        };
      } catch (error) {
        console.error("Error deleting the access token :", error);
        if (error instanceof TRPCError) {
          return {
            success: false,
            message: error.message,
          };
        }
        return {
          success: false,
          message: "Oops, something went wrong. Please try again later.",
        };
      }
    }),
});
