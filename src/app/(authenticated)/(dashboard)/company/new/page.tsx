import { CompanyForm } from "@/components/onboarding/company-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New",
};

const OnboardingPage = async () => {
  return (
    <div className="flex min-h-screen justify-center bg-background px-5 pb-5 pt-20">
      <div className="w-full max-w-2xl rounded-xl border bg-card p-10 text-card-foreground shadow">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {process.env.NEXT_PUBLIC_APP_NAME || "Hanzo Captable"}!
          </h1>
          <p className="text-sm text-muted-foreground">
            You are almost there. Please complete the form below to continue
          </p>
        </div>
        <CompanyForm type="create" />
      </div>
    </div>
  );
};

export default OnboardingPage;
