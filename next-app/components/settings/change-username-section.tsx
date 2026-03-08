"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Cancel01Icon, CheckmarkCircle02Icon, UserCircle02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { checkUsernameAction } from "@/app/(auth)/auth/actions";
import { changeUsernameAction } from "@/app/dashboard/settings/actions/username";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { type ChangeUsernameInput, ChangeUsernameSchema } from "@/lib/validations/auth";

type UsernameStatus = "idle" | "checking" | "available" | "taken";

interface ChangeUsernameSectionProps {
	currentUsername: string;
}

export function ChangeUsernameSection({ currentUsername }: ChangeUsernameSectionProps) {
	const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const checkedValueRef = useRef<string>("");

	const form = useForm<ChangeUsernameInput>({
		resolver: valibotResolver(ChangeUsernameSchema),
		defaultValues: { username: currentUsername },
	});

	const checkUsername = useCallback(
		(value: string) => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
			const trimmed = value.trim();
			checkedValueRef.current = trimmed;

			// No point checking if it's too short or is their current username
			if (trimmed.length < 3 || trimmed.toLowerCase() === currentUsername.toLowerCase()) {
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
					form.setError("username", { message: "This username is already taken." });
				}
			}, 400);
		},
		[currentUsername, form]
	);

	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	async function onSubmit(data: ChangeUsernameInput) {
		if (usernameStatus === "taken") {
			form.setError("username", { message: "This username is already taken." });
			return;
		}
		if (usernameStatus === "checking") {
			form.setError("username", { message: "Checking username availability…" });
			return;
		}
		const result = await changeUsernameAction(data.username);
		if (result.error) {
			toast.error(result.error);
		} else {
			toast.success("Username updated.");
			form.reset({ username: data.username });
			setUsernameStatus("idle");
		}
	}

	return (
		<SettingsSectionCard
			icon={UserCircle02Icon}
			title="Username"
			description="Your unique identifier on Scrimflow"
		>
			<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<Controller
					name="username"
					control={form.control}
					render={({ field, fieldState }) => (
						<Field data-invalid={fieldState.invalid || undefined}>
							<FieldLabel htmlFor="settings-username">Username</FieldLabel>
							<InputGroup>
								<InputGroupAddon align="inline-start" className="text-muted-foreground/70">
									scrimflow.com/players/
								</InputGroupAddon>
								<InputGroupInput
									{...field}
									id="settings-username"
									placeholder="your_username"
									autoComplete="username"
									aria-invalid={fieldState.invalid}
									className="font-mono"
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
				<Button
					type="submit"
					disabled={
						form.formState.isSubmitting || !form.formState.isDirty || usernameStatus === "taken"
					}
				>
					{form.formState.isSubmitting && <Spinner className="mr-2" />}
					{form.formState.isSubmitting ? "Saving…" : "Save username"}
				</Button>
			</form>
		</SettingsSectionCard>
	);
}
