"use client";

import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { toast } from "sonner";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
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
import { Input } from "@/components/ui/input";
import { apiRoutes } from "@/lib/routes";

interface RecoveryCodeManagementSectionProps {
	hasRecoveryCode: boolean;
}

export function RecoveryCodeManagementSection({
	hasRecoveryCode,
}: RecoveryCodeManagementSectionProps) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [isPending, setIsPending] = useState(false);
	const [code, setCode] = useState("");
	const [codeSent, setCodeSent] = useState(false);
	const [newCode, setNewCode] = useState<string | null>(null);

	async function handleRequestCode() {
		setIsPending(true);
		try {
			const res = await fetch(apiRoutes.settings.security.recoveryCodeRegenerateRequest, {
				method: "POST",
				credentials: "include",
			});
			if (!res.ok) throw new Error("Request failed");
			setCodeSent(true);
			toast.success("Verification code sent to your email.");
		} catch {
			toast.error("Failed to request verification. Please try again.");
		} finally {
			setIsPending(false);
		}
	}

	async function handleRegenerate() {
		setIsPending(true);
		try {
			const res = await fetch(apiRoutes.settings.security.recoveryCodeRegenerateConfirm, {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ code }),
			});
			if (!res.ok) throw new Error("Request failed");
			const json = (await res.json()) as { data: { recoveryCode: string } };
			setCode("");
			setCodeSent(false);
			setNewCode(json.data.recoveryCode);
		} catch {
			toast.error("Invalid or expired verification code. Please try again.");
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

			{codeSent && (
				<div className="mt-3 max-w-sm space-y-2">
					<Input
						value={code}
						onChange={(event) => setCode(event.currentTarget.value)}
						inputMode="numeric"
						autoComplete="one-time-code"
						placeholder="Verification code"
					/>
					<Button
						size="sm"
						disabled={isPending || code.trim().length === 0}
						onClick={handleRegenerate}
					>
						Confirm and show new code
					</Button>
				</div>
			)}

			<AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Regenerate recovery code?</AlertDialogTitle>
						<AlertDialogDescription>
							Your existing recovery code will be immediately invalidated. Make sure you save the
							new one. A verification code will be sent to your account email first.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setShowConfirm(false);
								handleRequestCode();
							}}
						>
							Send verification code
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<RecoveryCodeDialog recoveryCode={newCode} onConfirm={handleDialogConfirm} />
		</>
	);
}
