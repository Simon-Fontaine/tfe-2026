import { redirect } from "next/navigation";
import { AuthStepRouter } from "@/components/auth/auth-step-router";
import { getCurrentSession } from "@/lib/auth/session";
import type { AuthStep } from "@/stores/auth-flow";

interface AuthPageProps {
	searchParams: Promise<{ reset_token?: string; next?: string; step?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
	const { session, user } = await getCurrentSession();
	if (session && user && (!user.registered2FA || session.twoFactorVerified)) redirect("/dashboard");

	const { reset_token, next, step } = await searchParams;

	let initialStep: AuthStep | undefined;
	if (reset_token) initialStep = "reset-password";
	else if (step === "register") initialStep = "register";
	else if (step === "login") initialStep = "login";

	return <AuthStepRouter initialStep={initialStep} resetToken={reset_token} next={next} />;
}
