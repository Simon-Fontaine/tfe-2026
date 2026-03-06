"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { FingerPrintIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	deletePasskeyAction,
	listPasskeysAction,
	registerPasskeyAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import { CredentialListItem } from "@/components/shared/credential-list-item";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { registerPasskey } from "@/lib/auth/webauthn-client";
import { type CredentialNameInput, CredentialNameSchema } from "@/lib/validations/auth";
import { useSecurityStatus } from "@/stores/security-status";

interface PasskeyManagementSectionProps {
	userId: string;
	userName: string;
	userDisplayName: string;
}

interface CredentialInfo {
	id: string;
	name: string;
	createdAt?: string;
}

export function PasskeyManagementSection({
	userId,
	userName,
	userDisplayName,
}: PasskeyManagementSectionProps) {
	const [passkeys, setPasskeys] = useState<CredentialInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const { setPasskeyCount } = useSecurityStatus();

	const form = useForm<CredentialNameInput>({
		resolver: valibotResolver(CredentialNameSchema),
		defaultValues: { name: "" },
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
			setLoading(true);
			try {
				const encodedData = await registerPasskey({ userId, userName, userDisplayName });
				const result = await registerPasskeyAction(encodedData, data.name);
				if (result.error) {
					toast.error(result.error);
				} else {
					toast.success("Passkey registered.");
					form.reset();
					if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
					await refresh();
				}
			} catch {
				toast.error("Passkey registration failed. Your browser may not support this feature.");
			} finally {
				setLoading(false);
			}
		},
		[userId, userName, userDisplayName, refresh, form]
	);

	const handleDelete = useCallback(
		async (id: string) => {
			const result = await deletePasskeyAction(id);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Passkey removed.");
				await refresh();
			}
		},
		[refresh]
	);

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
							onDelete={() => handleDelete(pk.id)}
						/>
					))}
				</div>
			)}

			<form onSubmit={form.handleSubmit(handleRegister)} className="flex items-start gap-2">
				<Controller
					control={form.control}
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
					<Button type="submit" disabled={loading}>
						<HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} className="mr-1.5 size-4" />
						{loading ? "Adding…" : "Add"}
					</Button>
				</div>
			</form>
		</SettingsSectionCard>
	);
}
