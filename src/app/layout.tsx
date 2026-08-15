import logo from "@/assets/logo.svg";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/branding";
import { PublicEnvScript } from "@/components/public-env-script";
import ScreenSize from "@/components/screen-size";
import { constants } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { NextAuthProvider } from "@/providers/next-auth";
import { ProgressBarProvider } from "@/providers/progress-bar";
import { getServerComponentAuthSession } from "@/server/auth";
import { robotoMono, satoshi } from "@/styles/fonts";
import "@/styles/globals.css";
import { TRPCReactProvider } from "@/trpc/react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: {
    template: `%s | ${APP_NAME}`,
    default: APP_NAME,
  },
  description: APP_DESCRIPTION,
  icons: [{ rel: "icon", url: logo.src }],
  metadataBase: new URL(constants.url),
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerComponentAuthSession();
  const nodeEnv = process.env.NODE_ENV;

  return (
    // Dark, always. There is no theme switcher here, so the `.dark` palette was
    // never applied and the app rendered the light `:root` one — beside every
    // other Hanzo surface, which is black. Naming the class on <html> is also the
    // one place it cannot disagree with itself: read it from storage in a
    // provider instead and the server renders one palette, the client another,
    // and the mismatch takes the whole tree down to client rendering.
    <html lang="en" className={cn("dark", satoshi.variable, robotoMono.variable)}>
      <head>
        <PublicEnvScript />
      </head>
      <body className="min-h-screen">
        <ProgressBarProvider>
          <NextAuthProvider session={session}>
            <TRPCReactProvider cookies={cookies().toString()}>
              <main>{children}</main>
              <Toaster richColors />
              {nodeEnv === "development" && <ScreenSize />}
            </TRPCReactProvider>
          </NextAuthProvider>
        </ProgressBarProvider>
      </body>
    </html>
  );
}
