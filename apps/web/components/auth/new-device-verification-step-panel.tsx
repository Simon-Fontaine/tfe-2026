"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { resendVerificationAction, verifyNewDeviceAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import { type VerifyCodeInput, VerifyCodeSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function NewDeviceVerificationStepPanel() {
	const { email, next } = useAuthFlow();
	const { submit, isPending } = useAuthAction(verifyNewDeviceAction, {
		loadingMessage: "Verifying device…",
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
				icon={SmartPhone01Icon}
				iconClassName="text-amber-500"
				title="New device detected"
				subtitle={
					<>
						We sent a verification code to <strong>{email}</strong> to confirm this device
					</>
				}
				centered
			/>

			<form
				id="form-new-device-verification"
				onSubmit={form.handleSubmit(onSubmit)}
				className="space-y-3"
			>
				<FieldGroup>
					<Controller
						name="code"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="device-code">Verification code</FieldLabel>
								<Input
									{...field}
									id="device-code"
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
					Verify device
				</Button>
			</form>

			<p className="text-center text-xs text-muted-foreground">
				Didn&apos;t get the code?{" "}
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
