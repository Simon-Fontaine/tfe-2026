import { redirect } from "next/navigation";
import { buildTwoFactorMethods } from "@/app/(auth)/auth/actions/utils";
import { AuthStepRouter } from "@/components/auth/auth-step-router";
import { getCurrentSession } from "@/lib/auth/session";
import type { AuthStep, TwoFactorMethods } from "@/stores/auth-flow";

interface AuthPageProps {
	searchParams: Promise<{ reset_token?: string; next?: string; step?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
	const { session, user } = await getCurrentSession();
	if (session && user && (!user.registered2FA || session.twoFactorVerified)) redirect("/dashboard");

	const { reset_token, next, step } = await searchParams;

	let initialStep: AuthStep | undefined;
	let initialTwoFactorMethods: TwoFactorMethods | undefined;

	if (session && user && user.registered2FA && !session.twoFactorVerified) {
		initialStep = "two-factor";
		initialTwoFactorMethods = await buildTwoFactorMethods(user.id, {
			registeredTOTP: user.registeredTOTP,
			registeredPasskey: user.registeredPasskey,
			registeredSecurityKey: user.registeredSecurityKey,
		});
	} else if (reset_token) initialStep = "reset-password";
	else if (step === "register") initialStep = "register";
	else if (step === "login") initialStep = "login";

	return (
		<AuthStepRouter
			initialStep={initialStep}
			resetToken={reset_token}
			next={next}
			initialTwoFactorMethods={initialTwoFactorMethods}
		/>
	);
}
