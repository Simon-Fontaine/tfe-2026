"use client";

import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { apiRoutes } from "@/lib/routes";

interface RecoveryCodeManagementSectionProps {
	hasRecoveryCode: boolean;
}

export function RecoveryCodeManagementSection({
	hasRecoveryCode,
}: RecoveryCodeManagementSectionProps) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [newCode, setNewCode] = useState<string | null>(null);

	async function handleRegenerate() {
		setIsPending(true);
		try {
			const res = await fetch(apiRoutes.settings.security.recoveryCodeRegenerate, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) throw new Error("Request failed");
			const json = (await res.json()) as { data: { recoveryCode: string } };
			setNewCode(json.data.recoveryCode);
		} catch {
			toast.error("Failed to regenerate recovery code. Please try again.");
		} finally {
			setIsPending(false);
		}
	}

	function handleDialogConfirm() {
		toast.success("Recovery code regenerated. Store it somewhere safe.");
		setNewCode(null);
	}

	return (
		<>
			<SettingsSectionCard
				icon={SecurityCheckIcon}
				title="Recovery code"
				description="Use your recovery code if you lose access to your two-factor methods"
			>
				{hasRecoveryCode ? (
					<Alert>
						<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="size-4" />
						<AlertDescription>
							A recovery code is set. Store it somewhere safe — it can only be used once.
						</AlertDescription>
					</Alert>
				) : (
					<Alert variant="destructive">
						<HugeiconsIcon icon={SecurityCheckIcon} strokeWidth={2} className="size-4" />
						<AlertDescription>
							No recovery code set. Generate one to access your account if you lose all 2FA methods.
						</AlertDescription>
					</Alert>
				)}

				<Button
					variant="outline"
					size="sm"
					disabled={isPending}
					onClick={() => setShowConfirm(true)}
					className="mt-2 w-fit"
				>
					{hasRecoveryCode ? "Regenerate recovery code" : "Generate recovery code"}
				</Button>
			</SettingsSectionCard>

			<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Regenerate recovery code?</AlertDialogTitle>
						<AlertDialogDescription>
							Your existing recovery code will be immediately invalidated. Make sure you save the
							new one.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setShowConfirm(false);
								handleRegenerate();
							}}
						>
							Regenerate
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<RecoveryCodeDialog recoveryCode={newCode} onConfirm={handleDialogConfirm} />
		</>
	);
}
