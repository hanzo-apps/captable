"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { AuthFormHeader } from "../auth-form-header";

const SignUpForm = () => {
  async function signInWithHanzo() {
    await signIn("hanzo-iam", { callbackUrl: "/onboarding" });
  }

  return (
    <div className="flex h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-100">
      <div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-white p-10 shadow">
        <AuthFormHeader page="signup" />
        <Button
          type="button"
          onClick={signInWithHanzo}
          className="bg-red-500 hover:bg-red-600 text-white"
        >
          <svg
            className="mr-2 h-4 w-4"
            viewBox="0 0 67 67"
            fill="currentColor"
            role="img"
            aria-label="Hanzo"
          >
            <title>Hanzo</title>
            <path d="M22.21 67V44.6369H0V67H22.21Z" />
            <path d="M66.7038 22.3184H22.2534L0.0878906 44.6367H44.4634L66.7038 22.3184Z" />
            <path d="M22.21 0H0V22.3184H22.21V0Z" />
            <path d="M66.7198 0H44.5098V22.3184H66.7198V0Z" />
            <path d="M66.7198 67V44.6369H44.5098V67H66.7198Z" />
          </svg>
          Sign up with <span className="font-bold">Hanzo</span>
        </Button>
        <span className="text-center text-sm text-gray-500">
          Already have an account?{" "}
          <a
            href="/login"
            className="underline underline-offset-4 hover:text-primary"
          >
            Login
          </a>
        </span>
      </div>
    </div>
  );
};

export default SignUpForm;
