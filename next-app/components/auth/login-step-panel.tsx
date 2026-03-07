"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { FingerPrintIcon, HandGripIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { loginAction } from "@/app/(auth)/auth/actions";
import { loginWithPasskeyAction } from "@/app/(auth)/auth/webauthn-actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { PasswordInput } from "@/components/shared/password-input";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import { authenticateDiscoverable } from "@/lib/auth/webauthn-client";
import { type LoginInput, LoginSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function LoginStepPanel({ next }: { next?: string }) {
	const { goToRegister, goToForgotPassword } = useAuthFlow();
	const { submit, isPending } = useAuthAction(loginAction, {
		loadingMessage: "Signing in…",
		successMessage: "Signed in",
	});
	const [passkeyLoading, setPasskeyLoading] = useState(false);

	const form = useForm<LoginInput>({
		resolver: valibotResolver(LoginSchema),
		defaultValues: { email: "", password: "" },
	});

	function onSubmit(data: LoginInput) {
		const formData = new FormData();
		formData.set("email", data.email);
		formData.set("password", data.password);
		formData.set("next", next ?? "");
		submit(formData);
	}

	async function handlePasskeySignIn() {
		try {
			setPasskeyLoading(true);
			const encoded = await authenticateDiscoverable();
			const result = await loginWithPasskeyAction(encoded, next);
			if (result?.error) toast.error(result.error);
		} catch (error) {
			if (
				typeof error === "object" &&
				error !== null &&
				"digest" in error &&
				typeof (error as { digest: unknown }).digest === "string" &&
				(error as { digest: string }).digest.startsWith("NEXT_REDIRECT")
			) {
				toast.success("Signed in");
				return;
			}
			toast.error("Passkey authentication cancelled or failed.");
		} finally {
			setPasskeyLoading(false);
		}
	}

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={HandGripIcon}
				title="Welcome back"
				subtitle="Sign in to your Scrimflow account"
			/>

			<form id="form-login" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="email"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="login-email">Email</FieldLabel>
								<Input
									{...field}
									id="login-email"
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

					<Controller
						name="password"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="login-password">Password</FieldLabel>
								<PasswordInput
									{...field}
									id="login-password"
									placeholder="••••••••"
									autoComplete="current-password"
									aria-invalid={fieldState.invalid}
									disabled={isPending}
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				<div className="text-right">
					<Button
						type="button"
						variant="link"
						size="sm"
						onClick={goToForgotPassword}
						disabled={isPending}
						className="h-auto p-0 text-xs"
					>
						Forgot password?
					</Button>
				</div>

				<Button type="submit" className="w-full" disabled={isPending}>
					{isPending && <Spinner className="mr-2" />}
					Sign in
				</Button>
			</form>

			<div className="relative">
				<Separator aria-hidden="true" />
				<span
					className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground"
					aria-hidden="true"
				>
					or
				</span>
			</div>

			<Button
				type="button"
				variant="outline"
				className="w-full"
				onClick={handlePasskeySignIn}
				disabled={isPending || passkeyLoading}
			>
				{passkeyLoading ? (
					<Spinner className="mr-2" />
				) : (
					<HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="mr-2 size-4" />
				)}
				Sign in with passkey
			</Button>

			<p className="text-center text-xs text-muted-foreground">
				Don&apos;t have an account?{" "}
				<Button
					type="button"
					variant="link"
					className="h-auto p-0"
					onClick={goToRegister}
					disabled={isPending}
				>
					Create one
				</Button>
			</p>
		</div>
	);
}
