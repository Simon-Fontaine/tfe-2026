"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { LockIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { resetPasswordAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import {
	getPasswordStrength,
	type PasswordStrength,
	type ResetPasswordInput,
	ResetPasswordSchema,
} from "@/lib/validations/auth";

export function ResetPasswordStepPanel({ resetToken }: { resetToken: string }) {
	const { submit, isPending } = useAuthAction(resetPasswordAction, {
		loadingMessage: "Resetting password…",
	});
	const [pwStrength, setPwStrength] = useState<PasswordStrength | null>(null);

	const form = useForm<ResetPasswordInput>({
		resolver: valibotResolver(ResetPasswordSchema),
		defaultValues: { password: "", confirmPassword: "" },
	});

	function onSubmit(data: ResetPasswordInput) {
		const formData = new FormData();
		formData.set("reset_token", resetToken);
		formData.set("password", data.password);
		formData.set("confirmPassword", data.confirmPassword);
		submit(formData);
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={LockIcon}
				title="Set a new password"
				subtitle="Choose a strong password to protect your account"
			/>

			<form id="form-reset-password" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="password"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="reset-password">New password</FieldLabel>
								<PasswordInput
									{...field}
									id="reset-password"
									placeholder="••••••••"
									autoComplete="new-password"
									aria-invalid={fieldState.invalid}
									disabled={isPending}
									onChange={(e) => {
										field.onChange(e);
										const value = e.target.value;
										setPwStrength(value.length > 0 ? getPasswordStrength(value).strength : null);
									}}
								/>
								<PasswordStrengthMeter strength={pwStrength} />
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>

					<Controller
						name="confirmPassword"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="reset-confirm-password">Confirm password</FieldLabel>
								<PasswordInput
									{...field}
									id="reset-confirm-password"
									placeholder="••••••••"
									autoComplete="new-password"
									aria-invalid={fieldState.invalid}
									disabled={isPending}
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && <Spinner className="mr-2" />}
					Reset password
				</Button>
			</form>
		</div>
	);
}
