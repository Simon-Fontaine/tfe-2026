"use client";

import { CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

export function OnboardingCompletePanel() {
	const router = useRouter();

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={CheckmarkCircle02Icon}
				iconClassName="text-emerald-500"
				title="You're all set"
				centered
			/>

			<Button type="button" className="w-full" onClick={() => router.push(appRoutes.root)}>
				Go to Scrimflow
			</Button>
		</div>
	);
}
