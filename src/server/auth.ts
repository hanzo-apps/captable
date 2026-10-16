/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import {
  type DefaultSession,
  type NextAuthOptions,
  type Session,
  getServerSession,
} from "next-auth";

import { env } from "@/env";
import { SESSION_MAX_AGE, iamTokenExpiry, sessionLive } from "@/lib/session";
import type { MemberStatusEnum } from "@/prisma/enums";
import { type TPrismaOrTransaction, db } from "@/server/db";
import { getToken } from "next-auth/jwt";
import type { OAuthConfig } from "next-auth/providers/oauth";
import { cache } from "react";

const IAM_URL = process.env.IAM_URL;
const IAM_CLIENT_ID = process.env.IAM_CLIENT_ID;
const IAM_CLIENT_SECRET = process.env.IAM_CLIENT_SECRET;

/**
 * The IAM sign-in. An account here is the IAM subject it signed in as and
 * nothing else: next-auth finds it by (provider, providerAccountId = sub), and a
 * first sign-in whose address already names a user without that subject is
 * refused (OAuthAccountNotLinked) rather than merged into it. An address is a
 * label a person can be given, not proof they are the person it was given to.
 */
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
    // hanzo.id IS an OIDC provider and returns an id_token, so the callback has
    // to be the OIDC one. With this false, next-auth uses the plain-OAuth2 path
    // and openid-client throws on the token response — "id_token detected in
    // the response, you must use client.callback() instead of
    // client.oauthCallback()" — which reaches a signing-in user as nothing more
    // than `?error=OAuthCallback`. dataroom shipped exactly this and every
    // sign-in failed; the handoff to hanzo.id looks perfectly healthy either
    // way, so only completing a login tells the two apart.
    idToken: true,
    // The profile is IAM's userinfo, not the id_token's claims: only userinfo
    // states whether IAM has proven the address (`email_verified`), and an
    // invitation is accepted only by an address IAM has proven. next-auth hands
    // this the TokenSet its OIDC callback validated (typed as its parameters),
    // and given a TokenSet openid-client refuses a userinfo whose subject is
    // not the id_token's.
    userinfo: {
      url: `${issuer}/v1/iam/oauth/userinfo`,
      request: ({ client, tokens }) =>
        client.userinfo(tokens as Parameters<typeof client.userinfo>[0]),
    },
    profile(profile) {
      return {
        id: profile.sub,
        name: profile.displayName || profile.name || profile.preferred_username,
        email: profile.email,
        image: profile.avatar || profile.picture,
        emailVerified: profile.email_verified === true ? new Date() : null,
      };
    },
  };
}

/**
 * Records on the user row whether IAM has proven its address, as IAM answers on
 * this sign-in. next-auth creates a user with `emailVerified: null` whatever the
 * profile says, so the answer is written here, on every sign-in, and a proof IAM
 * withdraws stops counting at the next one.
 */
const recordEmailProof = async (
  userId: string,
  profile: { emailVerified?: Date | null } | undefined,
) => {
  await db.user.update({
    where: { id: userId },
    data: { emailVerified: profile?.emailVerified ?? null },
  });
};

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
    // The IAM token the cap-table backend authenticates with. It lives here and
    // only here: the JWT is an encrypted httpOnly cookie, while `session` is
    // served to the browser verbatim at /v1/iam/session.
    hanzoToken?: string;
    hanzoTokenExpires?: number;
  }
}

export const authOptions: NextAuthOptions = {
  events: {
    async signIn({ user, profile }) {
      await recordEmailProof(
        user.id,
        profile as { emailVerified?: Date | null } | undefined,
      );
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

    async jwt({ token, account, profile, trigger }) {
      // `account` is present on the sign-in pass only, so this is the one moment
      // the IAM access token is on offer. The cap-table backend reads the tenant
      // off this token's own claims, so keeping it is what makes the cap table
      // reachable at all.
      if (account?.access_token) {
        token.hanzoToken = account.access_token;
        token.hanzoTokenExpires = iamTokenExpiry(account);
      }

      // Every read of a session runs through here — the tRPC context, server
      // pages, the REST API's session cookie and the server actions all call
      // getServerSession — so this one check ends the session everywhere at
      // once. next-auth answers a throw by clearing the cookie and reporting no
      // session.
      if (!sessionLive(token)) {
        throw new Error("the Hanzo sign-in behind this session has expired");
      }

      // The org claim rides the verified id_token. It is not a User column, and
      // anything profile() returns is spread straight into prisma.user.create —
      // an unknown key there fails the insert and every first sign-in with it.
      const claims = profile as
        | { owner?: string; organization?: string; org?: string }
        | undefined;
      if (claims) {
        token.organization = claims.owner ?? claims.organization ?? claims.org;
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
  secret: env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  providers: [HanzoIAMProvider()],

  pages: {
    signIn: "/login",
    signOut: "/login",
  },
};

/** Split a `Cookie:` header into the name→value map `getToken` reads. */
const cookieJar = (header: string): Record<string, string> => {
  const jar: Record<string, string> = {};
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    jar[part.slice(0, eq).trim()] = decodeURIComponent(
      part.slice(eq + 1).trim(),
    );
  }
  return jar;
};

/**
 * The IAM access token this session signed in with, for calling the cap-table
 * backend as the user. Empty when the session predates the token being kept, or
 * when the token has outlived its own expiry — the caller then refuses the call
 * with something a person can act on rather than passing a dead bearer upstream.
 *
 * Read from the cookie alone. `getToken` will otherwise accept an `Authorization`
 * header as the session, and this app serves a public API whose callers send one.
 */
export async function hanzoAccessToken(headers: Headers): Promise<string> {
  const token = await getToken({
    req: {
      cookies: cookieJar(headers.get("cookie") ?? ""),
      headers: new Headers(),
    } as never,
    secret: env.NEXTAUTH_SECRET,
  });

  if (!token?.hanzoToken || !sessionLive(token)) return "";
  return token.hanzoToken;
}

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
  // ACTIVE is read from the row, not from the session: the session carries the
  // member id it signed in with, and a member an admin has since deactivated or
  // removed must stop acting now rather than when the cookie lapses.
  const data = await tx.member.findFirst({
    where: {
      id: session.user.memberId,
      companyId: session.user.companyId,
      isOnboarded: true,
      status: "ACTIVE",
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
