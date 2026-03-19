"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	cancelPasswordChangeAction,
	confirmPasswordChangeAction,
	requestPasswordChangeAction,
} from "@/app/dashboard/settings/actions/password";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
	type ConfirmPasswordChangeInput,
	ConfirmPasswordChangeSchema,
	getPasswordStrength,
	type RequestPasswordChangeInput,
	RequestPasswordChangeSchema,
} from "@/lib/validations/auth";

type Step = "idle" | "code-sent";

interface ChangePasswordSectionProps {
	initialStep?: Step;
}

export function ChangePasswordSection({ initialStep = "idle" }: ChangePasswordSectionProps) {
	const [step, setStep] = useState<Step>(initialStep);

	const requestForm = useForm<RequestPasswordChangeInput>({
		resolver: valibotResolver(RequestPasswordChangeSchema),
		defaultValues: { currentPassword: "" },
	});

	const confirmForm = useForm<ConfirmPasswordChangeInput>({
		resolver: valibotResolver(ConfirmPasswordChangeSchema),
		defaultValues: { newPassword: "", confirmNewPassword: "", code: "" },
	});

	const newPassword = confirmForm.watch("newPassword");
	const strength = newPassword ? getPasswordStrength(newPassword).strength : null;

	async function onRequest(data: RequestPasswordChangeInput) {
		const result = await requestPasswordChangeAction(data.currentPassword);
		if (result.error) {
			toast.error(result.error);
		} else {
			setStep("code-sent");
			toast.success("Verification code sent to your email.");
		}
	}

	async function onConfirm(data: ConfirmPasswordChangeInput) {
		const result = await confirmPasswordChangeAction(data.code, data.newPassword);
		if (result.error) {
			toast.error(result.error);
		} else {
			toast.success("Password changed. Other sessions have been signed out.");
			setStep("idle");
			requestForm.reset();
			confirmForm.reset();
		}
	}

	async function onCancel() {
		await cancelPasswordChangeAction();
		setStep("idle");
		requestForm.reset();
		confirmForm.reset();
	}

	return (
		<SettingsSectionCard
			icon={Key01Icon}
			title="Change password"
			description="Update your account password"
		>
			{step === "idle" && (
				<form onSubmit={requestForm.handleSubmit(onRequest)} className="space-y-3">
					<FieldGroup>
						<Controller
							name="currentPassword"
							control={requestForm.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="currentPassword">Current password</FieldLabel>
									<PasswordInput
										{...field}
										id="currentPassword"
										autoComplete="current-password"
										aria-invalid={fieldState.invalid}
									/>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
					</FieldGroup>

					<Button type="submit" disabled={requestForm.formState.isSubmitting}>
						{requestForm.formState.isSubmitting && <Spinner className="mr-2" />}
						{requestForm.formState.isSubmitting ? "Sending…" : "Send verification code"}
					</Button>
				</form>
			)}

			{step === "code-sent" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						A 6-digit code was sent to your email address. Enter it along with your new password to
						confirm the change.
					</p>

					<form onSubmit={confirmForm.handleSubmit(onConfirm)} className="space-y-3">
						<FieldGroup>
							<Controller
								name="code"
								control={confirmForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="pw-change-code">Verification code</FieldLabel>
										<Input
											{...field}
											id="pw-change-code"
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

							<Controller
								name="newPassword"
								control={confirmForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="newPassword">New password</FieldLabel>
										<PasswordInput
											{...field}
											id="newPassword"
											autoComplete="new-password"
											aria-invalid={fieldState.invalid}
										/>
										<PasswordStrengthMeter strength={strength} />
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</Field>
								)}
							/>

							<Controller
								name="confirmNewPassword"
								control={confirmForm.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid || undefined}>
										<FieldLabel htmlFor="confirmNewPassword">Confirm new password</FieldLabel>
										<PasswordInput
											{...field}
											id="confirmNewPassword"
											autoComplete="new-password"
											aria-invalid={fieldState.invalid}
										/>
										{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
									</Field>
								)}
							/>
						</FieldGroup>

						<div className="flex gap-2">
							<Button type="submit" disabled={confirmForm.formState.isSubmitting}>
								{confirmForm.formState.isSubmitting && <Spinner className="mr-2" />}
								{confirmForm.formState.isSubmitting ? "Changing…" : "Change password"}
							</Button>
							<Button type="button" variant="ghost" onClick={onCancel}>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}
		</SettingsSectionCard>
	);
}
