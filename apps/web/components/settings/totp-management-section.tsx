"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	generateTotpSecretAction,
	verifyAndEnableTotpAction,
} from "@/app/(auth)/auth/totp-setup-actions";
import {
	cancelTwoFactorDisableAction,
	confirmTwoFactorDisableAction,
	requestTwoFactorDisableAction,
} from "@/app/dashboard/settings/actions/two-factor-disable";
import { CodeDisplay } from "@/components/shared/code-display";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { type VerifyCodeInput, VerifyCodeSchema } from "@/lib/validations/auth";
import { useSecurityStatus } from "@/stores/security-status";

type State =
	| { step: "idle" }
	| { step: "setup"; secret: string; uri: string }
	| { step: "verify"; secret: string; uri: string }
	| { step: "disable-confirm" };

interface TotpManagementSectionProps {
	initialDisableConfirm?: boolean;
}

export function TotpManagementSection({
	initialDisableConfirm = false,
}: TotpManagementSectionProps) {
	const { hasTOTP, setHasTOTP } = useSecurityStatus();
	const [state, setState] = useState<State>(
		initialDisableConfirm ? { step: "disable-confirm" } : { step: "idle" }
	);
	const [loading, setLoading] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

	const setupForm = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	const disableForm = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	const handleSetup = useCallback(async () => {
		setLoading(true);
		const result = await generateTotpSecretAction();
		setLoading(false);
		if (result.error) {
			toast.error(result.error);
			return;
		}
		if (result.secret && result.uri) {
			setState({ step: "setup", secret: result.secret, uri: result.uri });
		}
	}, []);

	const handleVerify = useCallback(
		async (data: VerifyCodeInput) => {
			if (state.step !== "setup" && state.step !== "verify") return;
			setLoading(true);
			const result = await verifyAndEnableTotpAction(state.secret, data.code);
			setLoading(false);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setHasTOTP(true);
			setState({ step: "idle" });
			setupForm.reset();
			toast.success("Authenticator app enabled.");
			if (result.recoveryCode) {
				setRecoveryCode(result.recoveryCode);
			}
		},
		[state, setupForm, setHasTOTP]
	);

	const handleRequestDisable = useCallback(async () => {
		setLoading(true);
		const result = await requestTwoFactorDisableAction();
		setLoading(false);
		if (result.error) {
			toast.error(result.error);
			return;
		}
		setState({ step: "disable-confirm" });
		toast.success("Verification code sent to your email.");
	}, []);

	const handleConfirmDisable = useCallback(
		async (data: VerifyCodeInput) => {
			setLoading(true);
			const result = await confirmTwoFactorDisableAction(data.code);
			setLoading(false);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setHasTOTP(false);
			setRecoveryCode(null);
			setState({ step: "idle" });
			disableForm.reset();
			toast.success("Authenticator app disabled.");
		},
		[disableForm, setHasTOTP]
	);

	const handleCancelDisable = useCallback(async () => {
		await cancelTwoFactorDisableAction();
		setState({ step: "idle" });
		disableForm.reset();
	}, [disableForm]);

	return (
		<SettingsSectionCard
			id="totp"
			icon={Clock01Icon}
			title="Authenticator app (TOTP)"
			description={hasTOTP ? "Enabled — your authenticator app is active" : "Not configured"}
		>
			<RecoveryCodeDialog recoveryCode={recoveryCode} onConfirm={() => setRecoveryCode(null)} />

			{state.step === "idle" && (
				<div className="flex gap-2">
					{hasTOTP ? (
						<Button
							variant="outline"
							size="sm"
							className="text-destructive"
							onClick={handleRequestDisable}
							disabled={loading}
						>
							{loading ? "Sending…" : "Disable TOTP"}
						</Button>
					) : (
						<Button onClick={handleSetup} disabled={loading}>
							{loading ? "Generating…" : "Set up authenticator"}
						</Button>
					)}
				</div>
			)}

			{(state.step === "setup" || state.step === "verify") && (
				<div className="space-y-3">
					<p className="text-xs text-muted-foreground">
						Scan this QR code with your authenticator app, then enter the 6-digit code below.
					</p>
					<div
						className="flex justify-center"
						role="img"
						aria-label="QR code for authenticator app setup. Use the manual entry option if you cannot scan."
					>
						<QRCodeSVG
							value={state.uri}
							size={200}
							bgColor="#ffffff"
							fgColor="#000000"
							aria-hidden="true"
							includeMargin
						/>
					</div>
					<details className="text-xs">
						<summary className="cursor-pointer text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
							{"Can't scan? Enter manually"}
						</summary>
						<div className="mt-2">
							<CodeDisplay value={state.secret} />
						</div>
					</details>
					<form onSubmit={setupForm.handleSubmit(handleVerify)} className="space-y-3">
						<Controller
							name="code"
							control={setupForm.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="totp-code">Verification code</FieldLabel>
									<InputGroup>
										<InputGroupAddon>
											<HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="size-4" />
										</InputGroupAddon>
										<InputGroupInput
											{...field}
											id="totp-code"
											placeholder="000000"
											maxLength={6}
											inputMode="numeric"
											autoComplete="one-time-code"
											aria-invalid={fieldState.invalid}
										/>
									</InputGroup>
									{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
								</Field>
							)}
						/>
						<div className="flex gap-2">
							<Button type="submit" disabled={loading}>
								{loading ? "Verifying…" : "Verify & enable"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								onClick={() => {
									setState({ step: "idle" });
									setupForm.reset();
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}

			{state.step === "disable-confirm" && (
				<div className="space-y-4">
					<p className="text-sm text-muted-foreground">
						A 6-digit code was sent to your email address. Enter it to confirm disabling your
						authenticator app.
					</p>

					<form onSubmit={disableForm.handleSubmit(handleConfirmDisable)} className="space-y-3">
						<Controller
							name="code"
							control={disableForm.control}
							render={({ field, fieldState }) => (
								<Field data-invalid={fieldState.invalid || undefined}>
									<FieldLabel htmlFor="totp-disable-code">Verification code</FieldLabel>
									<Input
										{...field}
										id="totp-disable-code"
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
							<Button type="submit" variant="destructive" size="sm" disabled={loading}>
								{loading && <Spinner className="mr-2" />}
								{loading ? "Disabling…" : "Confirm disable"}
							</Button>
							<Button type="button" variant="ghost" onClick={handleCancelDisable}>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}
		</SettingsSectionCard>
	);
}
