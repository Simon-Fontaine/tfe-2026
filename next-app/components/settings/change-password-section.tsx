"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Key01Icon } from "@hugeicons/core-free-icons";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { changePasswordAction } from "@/app/dashboard/settings/actions/password";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
	type ChangePasswordInput,
	ChangePasswordSchema,
	getPasswordStrength,
} from "@/lib/validations/auth";

export function ChangePasswordSection() {
	const form = useForm<ChangePasswordInput>({
		resolver: valibotResolver(ChangePasswordSchema),
		defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
	});

	const newPassword = form.watch("newPassword");
	const strength = newPassword ? getPasswordStrength(newPassword).strength : null;

	async function onSubmit(data: ChangePasswordInput) {
		const result = await changePasswordAction(data.currentPassword, data.newPassword);
		if (result.error) {
			toast.error(result.error);
		} else {
			toast.success("Password changed successfully. Other sessions have been signed out.");
			form.reset();
		}
	}

	return (
		<SettingsSectionCard
			icon={Key01Icon}
			title="Change password"
			description="Update your account password"
		>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="currentPassword"
						control={form.control}
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

					<Controller
						name="newPassword"
						control={form.control}
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
						control={form.control}
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

				<Button type="submit" disabled={form.formState.isSubmitting}>
					{form.formState.isSubmitting && <Spinner className="mr-2" />}
					{form.formState.isSubmitting ? "Changing…" : "Change password"}
				</Button>
			</form>
		</SettingsSectionCard>
	);
}
