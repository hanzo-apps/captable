import { APP_NAME } from "@/lib/branding";
import SignInForm from "@/components/onboarding/signin";
import { getServerComponentAuthSession } from "@/server/auth";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Login",
  description: `Login to ${APP_NAME}`,
};

export default async function SignIn() {
  const session = await getServerComponentAuthSession();

  if (session?.user) {
    if (session?.user?.companyPublicId) {
      return redirect(`/${session.user.companyPublicId}`);
    }
    return redirect("/onboarding");
  }

  return <SignInForm />;
}
