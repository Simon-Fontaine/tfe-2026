"use client";

import { useEffect, useRef } from "react";
import { type AuthStep, type TwoFactorMethods, useAuthFlow } from "@/stores/auth-flow";
import { ForgotPasswordSentStepPanel } from "./forgot-password-sent-step-panel";
import { ForgotPasswordStepPanel } from "./forgot-password-step-panel";
import { LoginStepPanel } from "./login-step-panel";
import { NewDeviceVerificationStepPanel } from "./new-device-verification-step-panel";
import { RecoveryCodeStepPanel } from "./recovery-code-step-panel";
import { RegisterStepPanel } from "./register-step-panel";
import { ResetPasswordStepPanel } from "./reset-password-step-panel";
import { TwoFactorStepPanel } from "./two-factor-step-panel";
import { VerifyEmailStepPanel } from "./verify-email-step-panel";

interface AuthStepRouterProps {
	initialStep?: AuthStep;
	resetToken?: string;
	next?: string;
	initialTwoFactorMethods?: TwoFactorMethods;
}

export function AuthStepRouter({
	initialStep,
	resetToken,
	next,
	initialTwoFactorMethods,
}: AuthStepRouterProps) {
	const { step, transitionTo } = useAuthFlow();
	const containerRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: Mount-only — syncs URL params into store once
	useEffect(() => {
		if (initialStep) {
			transitionTo(initialStep, {
				resetToken,
				next,
				twoFactorMethods: initialTwoFactorMethods,
			});
		} else if (next) {
			transitionTo(step, { next });
		}
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: step is used intentionally as a trigger to re-focus on navigation
	useEffect(() => {
		containerRef.current?.focus();
	}, [step]);

	function renderStep() {
		switch (step) {
			case "login":
				return <LoginStepPanel next={next} />;
			case "register":
				return <RegisterStepPanel />;
			case "forgot-password":
				return <ForgotPasswordStepPanel />;
			case "forgot-password-sent":
				return <ForgotPasswordSentStepPanel />;
			case "verify-email":
				return <VerifyEmailStepPanel />;
			case "new-device-verification":
				return <NewDeviceVerificationStepPanel />;
			case "two-factor":
				return <TwoFactorStepPanel />;
			case "recovery-code":
				return <RecoveryCodeStepPanel />;
			case "reset-password":
				return <ResetPasswordStepPanel resetToken={resetToken ?? ""} />;
			default:
				return <LoginStepPanel next={next} />;
		}
	}

	return (
		<div ref={containerRef} tabIndex={-1} className="outline-none">
			{renderStep()}
		</div>
	);
}
