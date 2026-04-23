"use client";

import { OnboardingShellLayout } from "@/components/onboarding/onboarding-shell-layout";
import { Button } from "@/components/ui/button";

export default function OnboardingError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<OnboardingShellLayout>
			<div className="space-y-4">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">Setup error</h2>
					<p className="text-sm text-muted-foreground">
						{error.message || "Something went wrong loading your setup. Please try again."}
					</p>
				</div>
				<Button onClick={reset} variant="outline" size="sm">
					Try again
				</Button>
			</div>
		</OnboardingShellLayout>
	);
}
