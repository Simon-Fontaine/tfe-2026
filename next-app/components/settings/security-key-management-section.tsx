"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Key01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	deleteSecurityKeyAction,
	listSecurityKeysAction,
	registerSecurityKeyAction,
} from "@/app/(auth)/auth/webauthn-setup-actions";
import { CredentialListItem } from "@/components/shared/credential-list-item";
import { EmptyStateBlock } from "@/components/shared/empty-state-block";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { registerSecurityKey } from "@/lib/auth/webauthn-client";
import { type CredentialNameInput, CredentialNameSchema } from "@/lib/validations/auth";
import { useSecurityStatus } from "@/stores/security-status";

interface SecurityKeyManagementSectionProps {
	userId: string;
	userName: string;
	userDisplayName: string;
}

interface CredentialInfo {
	id: string;
	name: string;
	createdAt?: string;
}

export function SecurityKeyManagementSection({
	userId,
	userName,
	userDisplayName,
}: SecurityKeyManagementSectionProps) {
	const [keys, setKeys] = useState<CredentialInfo[]>([]);
	const [loading, setLoading] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
	const { setSecurityKeyCount } = useSecurityStatus();

	const form = useForm<CredentialNameInput>({
		resolver: valibotResolver(CredentialNameSchema),
		defaultValues: { name: "" },
	});

	const refresh = useCallback(async () => {
		const list = await listSecurityKeysAction();
		setKeys(list);
		setSecurityKeyCount(list.length);
	}, [setSecurityKeyCount]);

	useEffect(() => {
		refresh();
	}, [refresh]);

	const handleRegister = useCallback(
		async (data: CredentialNameInput) => {
			setLoading(true);
			try {
				const encodedData = await registerSecurityKey({ userId, userName, userDisplayName });
				const result = await registerSecurityKeyAction(encodedData, data.name);
				if (result.error) {
					toast.error(result.error);
				} else {
					toast.success("Security key registered.");
					form.reset();
					if (result.recoveryCode) setRecoveryCode(result.recoveryCode);
					await refresh();
				}
			} catch {
				toast.error("Security key registration failed. Make sure your key is connected.");
			} finally {
				setLoading(false);
			}
		},
		[userId, userName, userDisplayName, refresh, form]
	);

	const handleDelete = useCallback(
		async (id: string) => {
			const result = await deleteSecurityKeyAction(id);
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Security key removed.");
				await refresh();
			}
		},
		[refresh]
	);

	return (
		<SettingsSectionCard
			id="security-keys"
			icon={Key01Icon}
			title="Security keys"
			description="Use a hardware security key for two-factor authentication"
		>
			<RecoveryCodeDialog recoveryCode={recoveryCode} onConfirm={() => setRecoveryCode(null)} />

			{keys.length === 0 ? (
				<EmptyStateBlock
					icon={Key01Icon}
					title="No security keys"
					description="Register a hardware security key for extra protection."
				/>
			) : (
				<div className="mb-4 divide-y">
					{keys.map((k) => (
						<CredentialListItem
							key={k.id}
							icon={Key01Icon}
							name={k.name}
							createdAt={k.createdAt}
							onDelete={() => handleDelete(k.id)}
						/>
					))}
				</div>
			)}

			<form onSubmit={form.handleSubmit(handleRegister)} className="flex items-start gap-2">
				<Controller
					name="name"
					control={form.control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined} className="flex-1">
							<FieldLabel htmlFor="security-key-name">Key name</FieldLabel>
							<InputGroup>
								<InputGroupAddon>
									<HugeiconsIcon icon={Key01Icon} strokeWidth={2} className="size-4" />
								</InputGroupAddon>
								<InputGroupInput
									{...field}
									id="security-key-name"
									placeholder='e.g. "YubiKey 5"'
									aria-invalid={fieldState.invalid}
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
