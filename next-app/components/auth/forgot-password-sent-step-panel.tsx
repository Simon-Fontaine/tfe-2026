"use client";

import { InformationCircleIcon, SentIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useAuthFlow } from "@/stores/auth-flow";

export function ForgotPasswordSentStepPanel() {
	const { email, goToLogin } = useAuthFlow();

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={SentIcon}
				title="Check your email"
				subtitle="We sent a password reset link to"
				centered
			/>
			{email && <p className="text-center text-xs font-medium">{email}</p>}

			<Alert>
				<HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4" />
				<AlertDescription>
					Didn&apos;t receive the email? Check your spam folder or make sure you entered the correct
					address.
				</AlertDescription>
			</Alert>

			<Button type="button" className="w-full" onClick={goToLogin}>
				Back to sign in
			</Button>
		</div>
	);
}
