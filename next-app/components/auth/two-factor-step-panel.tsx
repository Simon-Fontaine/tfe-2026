"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import {
	Clock01Icon,
	FingerPrintIcon,
	Key01Icon,
	SecurityCheckIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { twoFactorAction } from "@/app/(auth)/auth/actions";
import {
	verifyPasskey2faAction,
	verifySecurityKey2faAction,
} from "@/app/(auth)/auth/webauthn-actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthAction } from "@/hooks/use-auth-action";
import { authenticate2fa } from "@/lib/auth/webauthn-client";
import { type VerifyCodeInput, VerifyCodeSchema } from "@/lib/validations/auth";
import { useAuthFlow } from "@/stores/auth-flow";

export function TwoFactorStepPanel() {
	const { twoFactorMethods, next, transitionTo } = useAuthFlow();
	const { submit, isPending } = useAuthAction(twoFactorAction, {
		loadingMessage: "Verifying…",
	});
	const [webauthnLoading, setWebauthnLoading] = useState(false);

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

	const hasTotp = twoFactorMethods?.totp;
	const hasPasskey = twoFactorMethods?.passkey;
	const hasSecurityKey = twoFactorMethods?.securityKey;

	async function handleWebAuthn(type: "passkey" | "securityKey") {
		try {
			setWebauthnLoading(true);
			const ids =
				type === "passkey"
					? twoFactorMethods?.passkeyCredentialIds
					: twoFactorMethods?.securityKeyCredentialIds;
			const encoded = await authenticate2fa(ids);
			const action = type === "passkey" ? verifyPasskey2faAction : verifySecurityKey2faAction;
			const result = await action(encoded, next);
			if (result?.error) toast.error(result.error);
		} catch {
			toast.error("Authentication cancelled or failed.");
		} finally {
			setWebauthnLoading(false);
		}
	}

	const defaultTab = hasTotp ? "totp" : hasPasskey ? "passkey" : "securitykey";

	return (
		<div className="space-y-4">
			<AuthPanelHeader
				icon={SecurityCheckIcon}
				title="Two-factor authentication"
				subtitle="Choose a method to verify your identity"
				centered
			/>

			<Tabs defaultValue={defaultTab}>
				<TabsList className="w-full">
					{hasTotp && (
						<TabsTrigger value="totp" className="flex-1">
							<HugeiconsIcon icon={Clock01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Authenticator
						</TabsTrigger>
					)}
					{hasPasskey && (
						<TabsTrigger value="passkey" className="flex-1">
							<HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="mr-1.5 size-4" />
							Passkey
						</TabsTrigger>
					)}
					{hasSecurityKey && (
						<TabsTrigger value="securitykey" className="flex-1">
							<HugeiconsIcon icon={Key01Icon} strokeWidth={2} className="mr-1.5 size-4" />
							Security key
						</TabsTrigger>
					)}
				</TabsList>

				{hasTotp && (
					<TabsContent value="totp" className="space-y-3 pt-2">
						<form id="form-totp-2fa" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
							<FieldGroup>
								<Controller
									name="code"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid || undefined}>
											<FieldLabel htmlFor="totp-code">Authentication code</FieldLabel>
											<Input
												{...field}
												id="totp-code"
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
					</TabsContent>
				)}

				{hasPasskey && (
					<TabsContent value="passkey" className="space-y-3 pt-2">
						<p className="text-center text-xs text-muted-foreground">
							Use your device&apos;s biometric or screen lock to verify
						</p>
						<Button
							type="button"
							className="w-full"
							onClick={() => handleWebAuthn("passkey")}
							disabled={webauthnLoading}
						>
							{webauthnLoading ? (
								<Spinner className="mr-2" />
							) : (
								<HugeiconsIcon icon={FingerPrintIcon} strokeWidth={2} className="mr-2 size-4" />
							)}
							Use passkey
						</Button>
					</TabsContent>
				)}

				{hasSecurityKey && (
					<TabsContent value="securitykey" className="space-y-3 pt-2">
						<p className="text-center text-xs text-muted-foreground">
							Insert and tap your security key
						</p>
						<Button
							type="button"
							className="w-full"
							onClick={() => handleWebAuthn("securityKey")}
							disabled={webauthnLoading}
						>
							{webauthnLoading ? (
								<Spinner className="mr-2" />
							) : (
								<HugeiconsIcon icon={Key01Icon} strokeWidth={2} className="mr-2 size-4" />
							)}
							Use security key
						</Button>
					</TabsContent>
				)}
			</Tabs>

			<p className="text-center text-xs text-muted-foreground">
				Lost access to your methods?{" "}
				<Button
					type="button"
					variant="link"
					className="h-auto p-0"
					onClick={() => transitionTo("recovery-code")}
					disabled={isPending}
				>
					Use recovery code
				</Button>
			</p>
		</div>
	);
}
