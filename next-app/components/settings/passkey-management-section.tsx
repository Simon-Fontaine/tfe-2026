"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { FingerPrintIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	listPasskeysAction,
	registerPasskeyAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import {
	cancelPasskeyDisableAction,
	confirmPasskeyDisableAction,
	requestPasskeyDisableAction,
} from "@/app/dashboard/settings/actions/credential-disable";
import { CredentialListItem } from "@/components/shared/credential-list-item";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { registerPasskey } from "@/lib/auth/webauthn-client";
import {
	type CredentialNameInput,
	CredentialNameSchema,
	type VerifyCodeInput,
	VerifyCodeSchema,
} from "@/lib/validations/auth";
import { useSecurityStatus } from "@/stores/security-status";

type DeleteState =
	| { step: "idle" }
	| { step: "confirm"; credentialId: string; credentialName: string };

interface CredentialInfo {
	id: string;
	name: string;
	createdAt?: string;
}

interface PasskeyManagementSectionProps {
	userId: string;
	userName: string;
	userDisplayName: string;
	initialDisableConfirm?: { credentialId: string; credentialName: string } | null;
}

export function PasskeyManagementSection({
	userId,
	userName,
	userDisplayName,
	initialDisableConfirm,
}: PasskeyManagementSectionProps) {
	const [passkeys, setPasskeys] = useState<CredentialInfo[]>([]);
	const [registerLoading, setRegisterLoading] = useState(false);
	const [actionLoading, setActionLoading] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const [deleteState, setDeleteState] = useState<DeleteState>(
		initialDisableConfirm ? { step: "confirm", ...initialDisableConfirm } : { step: "idle" }
	);
	const { setPasskeyCount } = useSecurityStatus();

	const registerForm = useForm<CredentialNameInput>({
		resolver: valibotResolver(CredentialNameSchema),
		defaultValues: { name: "" },
	});

	const disableForm = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	const refresh = useCallback(async () => {
		const list = await listPasskeysAction();
		setPasskeys(list);
		setPasskeyCount(list.length);
	}, [setPasskeyCount]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleRegister = useCallback(
		async (data: CredentialNameInput) => {
			setRegisterLoading(true);
			try {
				const encodedData = await registerPasskey({ userId, userName, userDisplayName });
				const result = await registerPasskeyAction(encodedData, data.name);
				if (result.error) {
					toast.error(result.error);
				} else {
					toast.success("Passkey registered.");
					registerForm.reset();
					if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
					await refresh();
				}
			} catch {
				toast.error("Passkey registration failed. Your browser may not support this feature.");
			} finally {
				setRegisterLoading(false);
			}
		},
		[userId, userName, userDisplayName, refresh, registerForm]
	);

	const handleRequestDelete = useCallback(async (id: string, name: string) => {
		setActionLoading(true);
		const result = await requestPasskeyDisableAction(id, name);
		setActionLoading(false);
		if (result.error) {
			toast.error(result.error);
			return;
		}
		setDeleteState({ step: "confirm", credentialId: id, credentialName: name });
		toast.success("Verification code sent to your email.");
	}, []);

	const handleConfirmDelete = useCallback(
		async (data: VerifyCodeInput) => {
			setActionLoading(true);
			const result = await confirmPasskeyDisableAction(data.code);
			setActionLoading(false);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			toast.success("Passkey removed.");
			setDeleteState({ step: "idle" });
			disableForm.reset();
			await refresh();
		},
		[disableForm, refresh]
	);

	const handleCancelDelete = useCallback(async () => {
		await cancelPasskeyDisableAction();
		setDeleteState({ step: "idle" });
		disableForm.reset();
	}, [disableForm]);

	return (
		<SettingsSectionCard
			id="passkeys"
			icon={FingerPrintIcon}
			title="Passkeys"
			description="Sign in with biometrics or your device"
		>
			<RecoveryCodeDialog recoveryCode={recoveryCode} onConfirm={() => setRecoveryCode(null)} />

			{passkeys.length === 0 ? (
				<EmptyStateBlock
					icon={FingerPrintIcon}
					title="No passkeys"
					description="Add a passkey for passwordless sign-in."
				/>
			) : (
				<div className="mb-4 divide-y">
					{passkeys.map((pk) => (
						<CredentialListItem
							key={pk.id}
							icon={FingerPrintIcon}
							name={pk.name}
							createdAt={pk.createdAt}
							disabled={deleteState.step === "confirm"}
							onDelete={() => handleRequestDelete(pk.id, pk.name)}
						/>
					))}
				</div>
			)}

			{deleteState.step === "confirm" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						A 6-digit code was sent to your email address. Enter it to confirm removing "
						{deleteState.credentialName}".
					</p>
					<form onSubmit={disableForm.handleSubmit(handleConfirmDelete)} className="space-y-3">
						<Controller
							name="code"
							control={disableForm.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="passkey-disable-code">Verification code</FieldLabel>
									<Input
										{...field}
										id="passkey-disable-code"
										placeholder="000000"
										maxLength={6}
										inputMode="numeric"
										autoComplete="one-time-code"
										aria-invalid={fieldState.invalid}
										className="font-mono tracking-widest"
									/>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
						<div className="flex gap-2">
							<Button type="submit" variant="destructive" size="sm" disabled={actionLoading}>
								{actionLoading && <Spinner className="mr-2" />}
								{actionLoading ? "Removing…" : "Confirm removal"}
							</Button>
							<Button type="button" variant="ghost" onClick={handleCancelDelete}>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}

			{deleteState.step === "idle" && (
				<form
					onSubmit={registerForm.handleSubmit(handleRegister)}
					className="flex items-start gap-2"
				>
					<Controller
						control={registerForm.control}
						name="name"
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined} className="flex-1">
								<FieldLabel htmlFor="passkey-name">Passkey name</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="size-4" />
									</InputGroupAddon>
									<InputGroupInput
										id="passkey-name"
										{...field}
										aria-invalid={fieldState.invalid}
										placeholder='e.g. "MacBook Pro"'
									/>
								</InputGroup>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
					<div className="pt-6">
						<Button type="submit" disabled={registerLoading}>
							<HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-1.5 size-4" />
							{registerLoading ? "Adding…" : "Add"}
						</Button>
					</div>
				</form>
			)}
		</SettingsSectionCard>
	);
}
