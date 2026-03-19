"use client";

import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface RecoveryCodeManagementSectionProps {
	hasRecoveryCode: boolean;
}

export function RecoveryCodeManagementSection({
	hasRecoveryCode,
}: RecoveryCodeManagementSectionProps) {
	return (
		<SettingsSectionCard
			icon={SecurityCheckIcon}
			title="Recovery code"
			description="Use your recovery code if you lose access to your two-factor methods"
		>
			{hasRecoveryCode ? (
				<Alert>
					<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="size-4" />
					<AlertDescription>
						You have a recovery code saved. It was generated when you set up your first two-factor
						method. Keep it stored securely.
					</AlertDescription>
				</Alert>
			) : (
				<Alert variant="destructive">
					<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="size-4" />
					<AlertDescription>
						No recovery code. Add a two-factor method to generate one automatically.
					</AlertDescription>
				</Alert>
			)}
		</SettingsSectionCard>
	);
}
