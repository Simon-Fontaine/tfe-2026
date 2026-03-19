"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Cancel01Icon, CheckmarkCircle02Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { checkUsernameAction, registerAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { PasswordInput } from "@/components/shared/password-input";
import { PasswordStrengthMeter } from "@/components/shared/password-strength-meter";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import {
	getPasswordStrength,
	type PasswordStrength,
	type RegisterInput,
	RegisterSchema,
} from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function RegisterStepPanel() {
	const { goToLogin } = useAuthFlow();
	const { state, submit, isPending } = useAuthAction(registerAction, {
		loadingMessage: "Creating account…",
	});
	const [pwStrength, setPwStrength] = useState<PasswordStrength | null>(null);
	const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">(
		"idle"
	);
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const checkedValueRef = useRef<string>("");

	const form = useForm<RegisterInput>({
		resolver: valibotResolver(RegisterSchema),
		defaultValues: {
			email: "",
			username: "",
			displayName: undefined,
			password: "",
			confirmPassword: "",
		},
	});

	function onSubmit(data: RegisterInput) {
		if (usernameStatus === "taken") {
			form.setError("username", { message: "This username is already taken" });
			return;
		}
		if (usernameStatus === "checking") {
			form.setError("username", { message: "Checking username availability…" });
			return;
		}
		const formData = new FormData();
		formData.set("email", data.email);
		formData.set("username", data.username);
		if (data.displayName) formData.set("displayName", data.displayName);
		formData.set("password", data.password);
		formData.set("confirmPassword", data.confirmPassword);
		submit(formData);
	}

	const checkUsername = useCallback(
		(value: string) => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			const trimmed = value.trim();
			checkedValueRef.current = trimmed;
			if (trimmed.length < 3) {
				setUsernameStatus("idle");
				form.clearErrors("username");
				return;
			}
			setUsernameStatus("checking");
			debounceRef.current = setTimeout(async () => {
				const { available } = await checkUsernameAction(trimmed);
				if (checkedValueRef.current !== trimmed) return;
				if (available) {
					setUsernameStatus("available");
					form.clearErrors("username");
				} else {
					setUsernameStatus("taken");
					form.setError("username", { message: "This username is already taken" });
				}
			}, 400);
		},
		[form]
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	useEffect(() => {
		if (!state?.fieldErrors) return;
		for (const [field, messages] of Object.entries(state.fieldErrors)) {
			if (field in form.getValues()) {
				form.setError(field as keyof RegisterInput, { message: messages?.[0] });
			}
		}
	}, [state, form]);

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={UserAdd01Icon}
				title="Create an account"
				subtitle="Join Scrimflow and start coordinating scrims"
			/>

			<form id="form-register" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<div className="grid gap-3 sm:grid-cols-2">
						<Controller
							name="email"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="reg-email">Email</FieldLabel>
									<Input
										{...field}
										id="reg-email"
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
							name="username"
							control={form.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="reg-username">Username</FieldLabel>
									<InputGroup>
										<InputGroupInput
											{...field}
											id="reg-username"
											placeholder="coolplayer99"
											autoComplete="username"
											aria-invalid={fieldState.invalid}
											disabled={isPending}
											onChange={(e) => {
												field.onChange(e);
												checkUsername(e.target.value);
											}}
										/>
										{usernameStatus !== "idle" && (
											<InputGroupAddon align="inline-end">
												{usernameStatus === "checking" && <Spinner className="size-4" />}
												{usernameStatus === "available" && (
													<HugeiconsIcon
														icon={CheckmarkCircle02Icon}
														strokeWidth={2}
														className="size-4 text-emerald-500"
													/>
												)}
												{usernameStatus === "taken" && (
													<HugeiconsIcon
														icon={Cancel01Icon}
														strokeWidth={2}
														className="size-4 text-destructive"
													/>
												)}
											</InputGroupAddon>
										)}
									</InputGroup>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
					</div>

					<Controller
						name="displayName"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="reg-displayName">Display name (optional)</FieldLabel>
								<Input
									{...field}
									value={field.value ?? ""}
									id="reg-displayName"
									placeholder="Your display name"
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
								<FieldLabel htmlFor="reg-password">Password</FieldLabel>
								<PasswordInput
									{...field}
									id="reg-password"
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
								<FieldLabel htmlFor="reg-confirmPassword">Confirm password</FieldLabel>
								<PasswordInput
									{...field}
									id="reg-confirmPassword"
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
					Create account
				</Button>
			</form>

			<p className="text-center text-xs text-muted-foreground">
				Already have an account?{" "}
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
