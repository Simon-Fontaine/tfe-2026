"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { HelpCircleIcon } from "@hugeicons/core-free-icons";
import { Controller, useForm } from "react-hook-form";
import { forgotPasswordAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import { type ForgotPasswordInput, ForgotPasswordSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function ForgotPasswordStepPanel() {
	const { goToLogin } = useAuthFlow();
	const { submit, isPending } = useAuthAction(forgotPasswordAction, {
		loadingMessage: "Sending reset link…",
	});

	const form = useForm<ForgotPasswordInput>({
		resolver: valibotResolver(ForgotPasswordSchema),
		defaultValues: { email: "" },
	});

	function onSubmit(data: ForgotPasswordInput) {
		const formData = new FormData();
		formData.set("email", data.email);
		submit(formData);
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={HelpCircleIcon}
				title="Forgot password?"
				subtitle={<>Enter your email and we&apos;ll send you a reset link</>}
			/>

			<form id="form-forgot-password" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="email"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="fp-email">Email</FieldLabel>
								<Input
									{...field}
									id="fp-email"
									type="email"
									placeholder="you@example.com"
									autoComplete="email"
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
					Send reset link
				</Button>
			</form>

			<p className="text-center text-xs text-muted-foreground">
				Remember your password?{" "}
				<Button
					type="button"
					variant="link"
					className="h-auto p-0"
					onClick={goToLogin}
					disabled={isPending}
				>
					Sign in
				</Button>
			</p>
		</div>
	);
}
