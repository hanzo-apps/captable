import SignInForm from "@/components/onboarding/signin";
import { APP_NAME } from "@/lib/branding";
import { sameSitePath } from "@/lib/same-site";
import { getServerComponentAuthSession } from "@/server/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: `Login to ${APP_NAME}`,
};

export default async function SignIn({
  searchParams,
}: {
  searchParams: { callbackUrl?: string; error?: string };
}) {
  const session = await getServerComponentAuthSession();
  const callbackUrl = sameSitePath(searchParams.callbackUrl, "/onboarding");

  if (session?.user) {
    if (callbackUrl !== "/onboarding") {
      return redirect(callbackUrl);
    }
    if (session?.user?.companyPublicId) {
      return redirect(`/${session.user.companyPublicId}`);
    }
    return redirect("/onboarding");
  }

  return <SignInForm callbackUrl={callbackUrl} error={searchParams.error} />;
}
