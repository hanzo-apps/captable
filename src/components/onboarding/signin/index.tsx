"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { AuthFormHeader } from "../auth-form-header";

const IAM_PROVIDER_NAME = process.env.NEXT_PUBLIC_IAM_PROVIDER_NAME || "Hanzo";

/** What a refused sign-in says, by the code next-auth puts in `?error=`. */
const REFUSALS: Record<string, string> = {
  OAuthAccountNotLinked:
    "This email address already belongs to a Captable account that was never signed in with Hanzo, so it cannot be joined to yours. Ask a company admin to invite you again.",
  AccessDenied: "This account may not sign in here.",
};

interface SignInFormProps {
  /** Where to land after signing in: a path on this site, already checked. */
  callbackUrl: string;
  error?: string;
}

const SignInForm = ({ callbackUrl, error }: SignInFormProps) => {
  async function signInWithIAM() {
    await signIn("hanzo-iam", { callbackUrl });
  }

  const refusal = error
    ? REFUSALS[error] ?? "Signing in did not complete. Try again."
    : "";

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-card p-10 text-card-foreground shadow">
        <AuthFormHeader page="signin" />
        {refusal ? (
          <p role="alert" className="text-sm text-destructive">
            {refusal}
          </p>
        ) : null}
        <Button type="button" onClick={signInWithIAM}>
          Sign in with <span className="font-bold">{IAM_PROVIDER_NAME}</span>
        </Button>
      </div>
    </div>
  );
};

export default SignInForm;
