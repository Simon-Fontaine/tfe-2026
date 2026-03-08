"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Mail01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	cancelEmailChangeAction,
	requestEmailChangeAction,
	verifyEmailChangeAction,
} from "@/app/dashboard/settings/actions/email-change";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import {
	type ChangeEmailInput,
	ChangeEmailSchema,
	type VerifyCodeInput,
	VerifyCodeSchema,
} from "@/lib/validations/auth";

type Step = "idle" | "code-sent";

interface ChangeEmailSectionProps {
	currentEmail: string;
	initialStep?: Step;
	initialPendingEmail?: string;
}

export function ChangeEmailSection({
	currentEmail,
	initialStep = "idle",
	initialPendingEmail,
}: ChangeEmailSectionProps) {
	const [step, setStep] = useState<Step>(initialStep);
	const [pendingEmail, setPendingEmail] = useState<string | null>(initialPendingEmail ?? null);

	const emailForm = useForm<ChangeEmailInput>({
		resolver: valibotResolver(ChangeEmailSchema),
		defaultValues: { newEmail: "" },
	});

	const codeForm = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	async function onRequestChange(data: ChangeEmailInput) {
		const result = await requestEmailChangeAction(data.newEmail);
		if (result.error) {
			toast.error(result.error);
		} else {
			setPendingEmail(data.newEmail);
			setStep("code-sent");
			toast.success(`Verification code sent to ${data.newEmail}`);
		}
	}

	async function onVerifyCode(data: VerifyCodeInput) {
		const result = await verifyEmailChangeAction(data.code);
		if (result.error) {
			toast.error(result.error);
		} else {
			toast.success("Email address updated. Other sessions have been signed out.");
			setStep("idle");
			emailForm.reset();
			codeForm.reset();
			setPendingEmail(null);
		}
	}

	async function onCancel() {
		await cancelEmailChangeAction();
		setStep("idle");
		emailForm.reset();
		codeForm.reset();
		setPendingEmail(null);
	}

	return (
		<SettingsSectionCard
			icon={Mail01Icon}
			title="Change email"
			description={`Current: ${currentEmail}`}
		>
			{step === "idle" && (
				<form onSubmit={emailForm.handleSubmit(onRequestChange)} className="space-y-3">
					<Controller
						name="newEmail"
						control={emailForm.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="newEmail">New email address</FieldLabel>
								<InputGroup>
									<InputGroupAddon>
										<HugeiconsIcon icon={Mail01Icon} strokeWidth={2} className="size-4" />
									</InputGroupAddon>
									<InputGroupInput
										{...field}
										id="newEmail"
										type="email"
										placeholder="you@example.com"
										autoComplete="email"
										aria-invalid={fieldState.invalid}
									/>
								</InputGroup>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
					<Button type="submit" disabled={emailForm.formState.isSubmitting}>
						{emailForm.formState.isSubmitting && <Spinner className="mr-2" />}
						{emailForm.formState.isSubmitting ? "Sending…" : "Send verification code"}
					</Button>
				</form>
			)}

			{step === "code-sent" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						A 6-digit verification code was sent to{" "}
						<span className="font-medium text-foreground">{pendingEmail}</span>. Enter it below to
						confirm the change.
					</p>

					<form onSubmit={codeForm.handleSubmit(onVerifyCode)} className="space-y-3">
						<Controller
							name="code"
							control={codeForm.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="email-change-code">Verification code</FieldLabel>
									<Input
										{...field}
										id="email-change-code"
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
							<Button type="submit" disabled={codeForm.formState.isSubmitting}>
								{codeForm.formState.isSubmitting && <Spinner className="mr-2" />}
								{codeForm.formState.isSubmitting ? "Verifying…" : "Confirm email change"}
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
