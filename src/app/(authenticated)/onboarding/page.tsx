import { CompanyForm } from "@/components/onboarding/company-form";
import { withServerComponentSession } from "@/server/auth";
import { COMPANY_STANDS, companyStands } from "@/server/company";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Onboarding",
};

const OnboardingPage = async () => {
  const session = await withServerComponentSession();
  const user = session.user;

  if (user.isOnboarded) {
    redirect("/dashboard");
  }

  // Signing in grants nothing: a person with no membership of the company that
  // stands sees who to ask, not a form that would make them an admin.
  if (await companyStands()) {
    return (
      <div className="flex min-h-screen justify-center bg-background px-5 pb-5 pt-20">
        <div className="w-full max-w-2xl rounded-xl border bg-card p-10 text-card-foreground shadow">
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">
            No access yet
          </h1>
          <p className="text-sm text-muted-foreground">{COMPANY_STANDS}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen justify-center bg-background px-5 pb-5 pt-20">
      <div className="w-full max-w-2xl rounded-xl border bg-card p-10 text-card-foreground shadow">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {process.env.NEXT_PUBLIC_APP_NAME || "Hanzo Captable"}
          </h1>
          <p className="text-sm text-muted-foreground">
            You are almost there. Please complete the form below to continue
          </p>
        </div>
        <CompanyForm type="onboarding" />
      </div>
    </div>
  );
};

export default OnboardingPage;
