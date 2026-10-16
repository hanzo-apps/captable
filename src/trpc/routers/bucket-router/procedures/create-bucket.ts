import { companyOwnsKey } from "@/lib/upload-policy";
import { Audit } from "@/server/audit";
import type { TPrismaOrTransaction } from "@/server/db";
import { withAccessControl } from "@/trpc/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  type TypeZodCreateBucketMutationSchema,
  ZodCreateBucketMutationSchema,
} from "../schema";

interface createBucketHandlerOptions {
  input: TypeZodCreateBucketMutationSchema;
  db: TPrismaOrTransaction;
  userAgent: string;
  requestIp: string;
  user?: {
    name: string;
    companyId: string;
    id: string;
  };
}

export const createBucketHandler = async ({
  db,
  input,
  userAgent,
  requestIp,
  user,
}: createBucketHandlerOptions) => {
  const bucket = await db.bucket.create({ data: input });

  await Audit.create(
    {
      action: "bucket.created",
      companyId: user?.companyId || "",
      actor: { type: "user", id: user?.id || "" },
      context: {
        userAgent,
        requestIp,
      },
      target: [{ type: "bucket", id: bucket.id }],
      summary: `${user?.name} created the bucket ${bucket.name}`,
    },
    db,
  );

  return bucket;
};

export const createBucketProcedure = withAccessControl
  .meta({ policies: { documents: { allow: ["create"] } } })
  .input(ZodCreateBucketMutationSchema)
  .mutation(
    async ({
      ctx: { db, userAgent, requestIp, session, membership },
      input,
    }) => {
      const { name, id } = session.user;
      const { companyId } = membership;

      // A bucket records an object this company's upload put in the store: the
      // store signs every such upload under the company's public id, so a key
      // under any other prefix is not this company's to record.
      const { publicId } = await db.company.findUniqueOrThrow({
        where: { id: companyId },
        select: { publicId: true },
      });
      if (!companyOwnsKey(input.key, publicId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This file was not uploaded for this company.",
        });
      }

      return await createBucketHandler({
        input,
        db,
        userAgent,
        requestIp,
        user: { name: name || "", companyId, id },
      });
    },
  );
