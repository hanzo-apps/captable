import { PrismaAdapter } from "@next-auth/prisma-adapter";
import {
  type DefaultSession,
  type NextAuthOptions,
  type Session,
  getServerSession,
} from "next-auth";

import { env } from "@/env";
import type { MemberStatusEnum } from "@/prisma/enums";
import { type TPrismaOrTransaction, db } from "@/server/db";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { cache } from "react";

const IAM_URL = process.env.IAM_URL;
const IAM_CLIENT_ID = process.env.IAM_CLIENT_ID;
const IAM_CLIENT_SECRET = process.env.IAM_CLIENT_SECRET;

// biome-ignore lint/suspicious/noExplicitAny: IAM profile shape varies
function HanzoIAMProvider(): OAuthConfig<any> {
  const issuer = IAM_URL || "https://hanzo.id";
  return {
    id: "hanzo-iam",
    name: process.env.IAM_PROVIDER_NAME || "Hanzo",
    type: "oauth",
    wellKnown: `${issuer}/.well-known/openid-configuration`,
    clientId: IAM_CLIENT_ID || "",
    clientSecret: IAM_CLIENT_SECRET || "",
    authorization: { params: { scope: "openid profile email" } },
    idToken: false,
    userinfo: { url: `${issuer}/oauth/userinfo` },
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.displayName || profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.avatar || profile.picture,
        organization: profile.owner || profile.organization || profile.org,
      };
    },
    allowDangerousEmailAccountLinking: true,
  };
}

export const JWT_SECRET = new TextEncoder().encode(env.NEXTAUTH_SECRET);

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      isOnboarded: boolean;
      companyId: string;
      memberId: string;
      companyPublicId: string;
      status: MemberStatusEnum | "";
      organization?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    companyId: string;
    memberId: string;
    isOnboarded: boolean;
    companyPublicId: string;
    status: MemberStatusEnum | "";
    organization?: string;
  }
}

export const authOptions: NextAuthOptions = {
  events: {
    async linkAccount({ user }) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },
  callbacks: {
    signIn() {
      return true;
    },
    session({ session, token }) {
      session.user.isOnboarded = token.isOnboarded;
      session.user.companyId = token.companyId;
      session.user.memberId = token.memberId;
      session.user.companyPublicId = token.companyPublicId;
      session.user.status = token.status;
      session.user.organization = token.organization;
      session.user.name = token.name;
      session.user.email = token.email;
      session.user.image = token.picture ?? "";

      if (token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },

    async jwt({ token, user, trigger }) {
      // Persist IAM organization claim from initial sign-in
      const orgUser = user as { organization?: string } | undefined;
      if (orgUser?.organization) {
        token.organization = orgUser.organization;
      }
      if (trigger) {
        const member = await db.member.findFirst({
          where: {
            userId: token.sub,
            isOnboarded: true,
            status: "ACTIVE",
          },
          orderBy: {
            lastAccessed: "desc",
          },
          select: {
            id: true,
            status: true,
            companyId: true,
            isOnboarded: true,
            user: {
              select: {
                name: true,
                image: true,
              },
            },
            company: {
              select: {
                publicId: true,
              },
            },
          },
        });
        if (member) {
          token.status = member.status;
          token.name = member.user?.name;
          token.memberId = member.id;
          token.companyId = member.companyId;
          token.isOnboarded = member.isOnboarded;
          token.companyPublicId = member.company.publicId;
          token.picture = member.user?.image;
        } else {
          token.status = "";
          token.companyId = "";
          token.memberId = "";
          token.isOnboarded = false;
          token.companyPublicId = "";
        }
      }
      return token;
    },
  },
  // @ts-expect-error
  adapter: PrismaAdapter(db),
  secret: env.NEXTAUTH_SECRET ?? "secret",
  session: {
    strategy: "jwt",
  },
  providers: [HanzoIAMProvider()],

  pages: {
    signIn: "/login",
    signOut: "/login",
  },
};

export const getServerAuthSession = () => getServerSession(authOptions);

export const getServerComponentAuthSession = cache(() =>
  getServerAuthSession(),
);

export const withServerSession = async () => {
  const session = await getServerAuthSession();

  if (!session) {
    throw new Error("session not found");
  }

  return session;
};

export const withServerComponentSession = cache(async () => {
  const session = await getServerComponentAuthSession();

  if (!session) {
    throw new Error("session not found");
  }

  return session;
});

export interface checkMembershipOptions {
  session: Session;
  tx: TPrismaOrTransaction;
}

export async function checkMembership({ session, tx }: checkMembershipOptions) {
  const data = await tx.member.findFirst({
    where: {
      id: session.user.memberId,
      companyId: session.user.companyId,
      isOnboarded: true,
    },
    select: {
      id: true,
      companyId: true,
      role: true,
      customRoleId: true,
      userId: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });

  if (!data) {
    throw new Error("membership not found");
  }

  const { companyId, id: memberId, ...rest } = data;

  return { companyId, memberId, ...rest };
}
