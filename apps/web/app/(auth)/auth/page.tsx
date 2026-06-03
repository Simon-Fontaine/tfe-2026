import { appRoutes } from "@scrimflow/shared";
import { redirect } from "next/navigation";
import {
	listPasskeysAction,
	listSecurityKeysAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import { AuthStepRouter } from "@/components/auth/auth-step-router";
import { getCurrentSession } from "@/lib/auth/session";
import type { AuthStep, TwoFactorMethods } from "@/stores/auth-flow";

interface AuthPageProps {
	searchParams: Promise<{ reset_token?: string; next?: string; step?: string }>;
}

export default async function AuthPage({ searchParams }: AuthPageProps) {
	const { session, user } = await getCurrentSession();
	if (session && user && (!user.registered2FA || session.twoFactorVerified)) {
		redirect(appRoutes.root);
	}

	const { reset_token, next, step } = await searchParams;

	let initialStep: AuthStep | undefined;
	let initialTwoFactorMethods: TwoFactorMethods | undefined;

	if (session && user && user.registered2FA && !session.twoFactorVerified) {
		initialStep = "two-factor";
		const [passkeys, securityKeys] = await Promise.all([
			user.registeredPasskey ? listPasskeysAction() : Promise.resolve([]),
			user.registeredSecurityKey ? listSecurityKeysAction() : Promise.resolve([]),
		]);
		initialTwoFactorMethods = {
			totp: user.registeredTOTP,
			passkey: user.registeredPasskey,
			securityKey: user.registeredSecurityKey,
			passkeyCredentialIds: passkeys.map((c) => c.id),
			securityKeyCredentialIds: securityKeys.map((c) => c.id),
		};
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
