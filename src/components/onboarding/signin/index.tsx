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
		<div className="flex h-screen items-center justify-center bg-background">
			<div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-card p-10 text-card-foreground shadow">
				<AuthFormHeader page="signin" />
				<Button type="button" onClick={signInWithIAM}>
					Sign in with <span className="font-bold">{IAM_PROVIDER_NAME}</span>
				</Button>
			</div>
		</div>
	);
};

export default SignInForm;
