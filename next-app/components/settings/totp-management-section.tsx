"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Clock01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	disableTotpAction,
	generateTotpSecretAction,
	verifyAndEnableTotpAction,
} from "@/app/(auth)/auth/totp-setup-actions";
import { CodeDisplay } from "@/components/shared/code-display";
import { RecoveryCodeDialog } from "@/components/shared/recovery-code-dialog";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { type VerifyCodeInput, VerifyCodeSchema } from "@/lib/validations/auth";
import { useSecurityStatus } from "@/stores/security-status";

type State =
	| { step: "idle" }
	| { step: "setup"; secret: string; uri: string }
	| { step: "verify"; secret: string; uri: string };

export function TotpManagementSection() {
	const { hasTOTP, setHasTOTP } = useSecurityStatus();
	const [state, setState] = useState<State>({ step: "idle" });
	const [loading, setLoading] = useState(false);
	const [recoveryCode, setRecoveryCode] = useState<string | null>(null);

	const form = useForm<VerifyCodeInput>({
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
			form.reset();
			toast.success("Authenticator app enabled.");
			if (result.recoveryCode) {
				setRecoveryCode(result.recoveryCode);
			}
		},
		[state, form, setHasTOTP]
	);

	const handleDisable = useCallback(async () => {
		setLoading(true);
		const result = await disableTotpAction();
		setLoading(false);
		if (result.error) {
			toast.error(result.error);
			return;
		}
		setHasTOTP(false);
		setRecoveryCode(null);
		toast.success("Authenticator app disabled.");
	}, [setHasTOTP]);

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
							onClick={handleDisable}
							disabled={loading}
						>
							{loading ? "Disabling…" : "Disable TOTP"}
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
						aria-label="QR code for authenticator app setup. Use the manual entry option below if you cannot scan."
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
						<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
							Can&apos;t scan? Enter manually
						</summary>
						<div className="mt-2">
							<CodeDisplay value={state.secret} />
						</div>
					</details>
					<form onSubmit={form.handleSubmit(handleVerify)} className="space-y-3">
						<Controller
							name="code"
							control={form.control}
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
									form.reset();
								}}
							>
								Cancel
							</Button>
						</div>
					</form>
				</div>
			)}
		</SettingsSectionCard>
	);
}
