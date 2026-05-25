"use client";

import { useEffect, useRef, useState } from "react";
import { deleteOrgAction, requestOrgDeletionCodeAction } from "@/app/actions/org";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useFormAction } from "@/hooks/use-form-action";

interface DeleteOrgDialogProps {
	orgId: string;
	orgName: string;
	children: React.ReactNode;
}

const RETENTION_OPTIONS = [
	{ value: "archive_all_teams", label: "Archive all teams" },
	{ value: "preserve_history", label: "Preserve history only" },
	{ value: "anonymize_public_history", label: "Anonymize public history" },
] as const;

type RetentionPolicy = (typeof RETENTION_OPTIONS)[number]["value"];

export function DeleteOrgDialog({ orgId, orgName, children }: DeleteOrgDialogProps) {
	const [open, setOpen] = useState(false);
	const [confirmName, setConfirmName] = useState("");
	const [reason, setReason] = useState("");
	const [verificationCode, setVerificationCode] = useState("");
	const [retentionPolicy, setRetentionPolicy] = useState<RetentionPolicy>("archive_all_teams");
	const pendingRef = useRef(false);

	const { state, submit, isPending } = useFormAction(deleteOrgAction, {
		loadingMessage: "Requesting deletion…",
	});
	const codeForm = useFormAction(requestOrgDeletionCodeAction, {
		loadingMessage: "Sending code…",
		successMessage: "Verification code sent",
	});

	useEffect(() => {
		if (state?.success && pendingRef.current) {
			pendingRef.current = false;
			setOpen(false);
		}
	}, [state]);

	function handleDelete() {
		if (confirmName !== orgName) return;
		pendingRef.current = true;
		const fd = new FormData();
		fd.set("orgId", orgId);
		fd.set("confirmName", confirmName);
		fd.set("reason", reason);
		fd.set("retentionPolicy", retentionPolicy);
		fd.set("verificationCode", verificationCode);
		submit(fd);
	}

	function requestCode() {
		const fd = new FormData();
		fd.set("orgId", orgId);
		codeForm.submit(fd);
	}

	return (
		<AlertDialog
			open={open}
			onOpenChange={(o) => {
				setOpen(o);
				if (!o) {
					setConfirmName("");
					setReason("");
					setVerificationCode("");
					setRetentionPolicy("archive_all_teams");
				}
			}}
		>
			<AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Request organization deletion</AlertDialogTitle>
					<AlertDialogDescription>
						This places <strong>{orgName}</strong> into deletion-pending, hides public discovery,
						archives active teams, and preserves historical records during the recovery window. Type
						the organization name below to confirm.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<Input
					value={confirmName}
					onChange={(e) => setConfirmName(e.target.value)}
					placeholder={orgName}
					className="mt-2"
				/>
				<textarea
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					maxLength={800}
					rows={3}
					placeholder="Reason for deletion-pending request"
					className="mt-2 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
				/>
				{/* D6-P: let the owner choose a retention policy instead of hardcoding archive_all_teams */}
				<div className="space-y-1">
					<p className="text-xs font-medium">Retention policy</p>
					<div className="flex flex-col gap-1.5">
						{RETENTION_OPTIONS.map((opt) => (
							<label key={opt.value} className="flex items-center gap-2 text-xs">
								<input
									type="radio"
									name="retentionPolicy"
									value={opt.value}
									checked={retentionPolicy === opt.value}
									onChange={() => setRetentionPolicy(opt.value)}
									className="accent-primary"
								/>
								{opt.label}
							</label>
						))}
					</div>
				</div>
				<div className="space-y-2">
					<Input
						value={verificationCode}
						onChange={(e) => setVerificationCode(e.target.value)}
						placeholder="Verification code"
					/>
					<Button
						type="button"
						variant="outline"
						onClick={requestCode}
						disabled={codeForm.isPending}
					>
						{codeForm.isPending && <Spinner className="mr-1.5" />}
						Send verification code
					</Button>
					{/* P26: render code-request errors that were previously silently dropped */}
					{codeForm.state?.error && (
						<p className="text-xs text-destructive">{codeForm.state.error}</p>
					)}
				</div>
				<AlertDialogFooter>
					<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={confirmName !== orgName || verificationCode.trim().length === 0 || isPending}
					>
						{isPending && <Spinner className="mr-1.5" />}
						Request deletion
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
