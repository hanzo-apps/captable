"use client";

import { Button } from "@/components/ui/button";
import { signIn } from "next-auth/react";
import { AuthFormHeader } from "../auth-form-header";

const IAM_PROVIDER_NAME =
	process.env.NEXT_PUBLIC_IAM_PROVIDER_NAME || "Hanzo";

const SignUpForm = () => {
	async function signInWithIAM() {
		await signIn("hanzo-iam", { callbackUrl: "/onboarding" });
	}

	return (
		<div className="flex h-screen items-center justify-center bg-background">
			<div className="grid w-full max-w-md grid-cols-1 gap-5 rounded-xl border bg-card p-10 text-card-foreground shadow">
				<AuthFormHeader page="signup" />
				<Button type="button" onClick={signInWithIAM}>
					Sign up with{" "}
					<span className="font-bold">{IAM_PROVIDER_NAME}</span>
				</Button>
				<span className="text-center text-sm text-muted-foreground">
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
