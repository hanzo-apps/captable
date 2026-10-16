import { type TPrismaOrTransaction, db } from "./db";

/**
 * The refusal a person meets when the company already stands. One deployment
 * keeps one company — its cap table is the signed-in org's, read from Hanzo
 * Cloud — so a second company would be a second name for the same cap table,
 * and its founder its ADMIN by nothing more than signing in.
 */
export const COMPANY_STANDS =
  "This Captable already has its company. Ask one of its admins to invite you.";

/** Whether the deployment's one company has been created. */
export const companyStands = async (tx: TPrismaOrTransaction = db) =>
  (await tx.company.count()) > 0;

export const getCompanyList = async (userId: string) => {
  const data = await db.member.findMany({
    where: {
      userId,
      status: "ACTIVE",
      isOnboarded: true,
    },
    select: {
      id: true,
      company: {
        select: {
          id: true,
          publicId: true,
          name: true,
        },
      },
    },
  });

  return data;
};

export type TGetCompanyList = Awaited<ReturnType<typeof getCompanyList>>;
