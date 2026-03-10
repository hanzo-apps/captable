"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { AuthFormHeader } from "../auth-form-header";

const IAM_PROVIDER_NAME =
	process.env.NEXT_PUBLIC_IAM_PROVIDER_NAME || "Hanzo";

const SignInForm = () => {
	async function signInWithIAM() {
		await signIn("hanzo-iam", { callbackUrl: "/onboarding" });
	}

	return (
		<div className="flex h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-100">
			<div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-white p-10 shadow">
				<AuthFormHeader page="signin" />
				<Button
					type="button"
					onClick={signInWithIAM}
					className="bg-red-500 hover:bg-red-600 text-white"
				>
					Sign in with <span className="font-bold">{IAM_PROVIDER_NAME}</span>
				</Button>
			</div>
		</div>
	);
};

export default SignInForm;
