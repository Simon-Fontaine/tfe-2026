"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { MailOpenIcon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { resendVerificationAction, verifyEmailAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import { type VerifyCodeInput, VerifyCodeSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function VerifyEmailStepPanel() {
	const { email, next } = useAuthFlow();
	const { submit, isPending } = useAuthAction(verifyEmailAction, {
		loadingMessage: "Verifying…",
	});
	const [resending, setResending] = useState(false);

	const form = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	function onSubmit(data: VerifyCodeInput) {
		const formData = new FormData();
		formData.set("next", next ?? "");
		formData.set("code", data.code);
		submit(formData);
	}

	async function handleResend() {
		try {
			setResending(true);
			const result = await resendVerificationAction();
			if (result.error) toast.error(result.error);
			else toast.success("A new verification code has been sent.");
		} finally {
			setResending(false);
		}
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={MailOpenIcon}
				title="Verify your email"
				subtitle={
					<>
						Enter the 6-digit code sent to <strong>{email}</strong>
					</>
				}
				centered
			/>

			<form id="form-verify-email" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="code"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="verify-code">Verification code</FieldLabel>
								<Input
									{...field}
									id="verify-code"
									placeholder="000000"
									maxLength={6}
									autoComplete="one-time-code"
									aria-invalid={fieldState.invalid}
									disabled={isPending}
									className="text-center tracking-[0.3em]"
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && <Spinner className="mr-2" />}
					Verify
				</Button>
			</form>

			<p className="text-center text-xs text-muted-foreground">
				Didn&apos;t receive the code?{" "}
				<Button
					type="button"
					variant="link"
					className="h-auto p-0"
					onClick={handleResend}
					disabled={resending || isPending}
				>
					{resending ? "Sending…" : "Resend code"}
				</Button>
			</p>
		</div>
	);
}
