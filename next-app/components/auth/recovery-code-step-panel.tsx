"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Alert02Icon, ArrowLeft01Icon, Key01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { recoveryCodeAction } from "@/app/(auth)/auth/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { CodeDisplay } from "@/components/shared/code-display";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuthAction } from "@/hooks/use-auth-action";
import { type RecoveryCodeInput, RecoveryCodeSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function RecoveryCodeStepPanel() {
	const { next, transitionTo } = useAuthFlow();
	const { state, submit, isPending } = useAuthAction(recoveryCodeAction, {
		loadingMessage: "Verifying recovery code…",
	});
	const router = useRouter();

	const form = useForm<RecoveryCodeInput>({
		resolver: valibotResolver(RecoveryCodeSchema),
		defaultValues: { code: "" },
	});

	function onSubmit(data: RecoveryCodeInput) {
		const formData = new FormData();
		formData.set("next", next ?? "");
		formData.set("code", data.code);
		submit(formData);
	}

	const newRecoveryCode = state?.newRecoveryCode;

	if (newRecoveryCode) {
		return (
			<div className="space-y-4">
				<AuthPanelHeader
					icon={Alert02Icon}
					iconClassName="text-amber-500"
					title="Save your new recovery code"
					subtitle="Your old 2FA methods have been removed. Save this code somewhere safe."
					centered
				/>

				<Alert
					variant="destructive"
					className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-600"
				>
					<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
					<AlertDescription>
						This is your only chance to save this code. If you lose it, you may be locked out of
						your account.
					</AlertDescription>
				</Alert>

				<CodeDisplay value={newRecoveryCode} />

				<Button
					type="button"
					className="w-full"
					onClick={() => router.push(state?.next || next || "/dashboard")}
				>
					I&apos;ve saved my code — continue
				</Button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div>
				<Button
					type="button"
					variant="ghost"
					size="sm"
					onClick={() => transitionTo("two-factor")}
					className="mb-2"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="mr-1.5 size-4" />
					Back to 2FA
				</Button>
				<AuthPanelHeader
					icon={Key01Icon}
					title="Recovery code"
					subtitle="Enter the recovery code you saved when setting up 2FA"
				/>
			</div>

			<Alert
				variant="destructive"
				className="border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 [&>svg]:text-amber-600"
			>
				<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} className="size-4" />
				<AlertDescription>
					Using your recovery code will remove all existing 2FA methods from your account.
				</AlertDescription>
			</Alert>

			<form id="form-recovery-code" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
				<FieldGroup>
					<Controller
						name="code"
						control={form.control}
						render={({ field, fieldState }) => (
							<Field data-invalid={fieldState.invalid || undefined}>
								<FieldLabel htmlFor="recovery-code">Recovery code</FieldLabel>
								<Input
									{...field}
									id="recovery-code"
									placeholder="Enter your recovery code"
									aria-invalid={fieldState.invalid}
									disabled={isPending}
								/>
								{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
							</Field>
						)}
					/>
				</FieldGroup>

				<Button type="submit" variant="destructive" className="w-full" disabled={isPending}>
					{isPending && <Spinner className="mr-2" />}
					Use recovery code
				</Button>
			</form>
		</div>
	);
}
