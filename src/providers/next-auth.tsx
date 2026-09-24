"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type React from "react";

import { AUTH_BASE_PATH } from "@/constants/auth";

export type NextAuthProviderProps = {
  session?: Session | null;
  children: React.ReactNode;
};

export const NextAuthProvider = ({
  session,
  children,
}: NextAuthProviderProps) => {
  return (
    <SessionProvider session={session} basePath={AUTH_BASE_PATH}>
      {children}
    </SessionProvider>
  );
};
