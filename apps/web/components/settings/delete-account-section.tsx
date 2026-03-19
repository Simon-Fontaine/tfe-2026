"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Alert02Icon, Delete02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import {
	confirmAccountDeletionAction,
	requestAccountDeletionAction,
} from "@/app/dashboard/settings/actions/account-deletion";
import { SettingsSectionCard } from "@/components/shared/settings-section-card";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogMedia,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
	type DeleteAccountInput,
	DeleteAccountSchema,
	type VerifyCodeInput,
	VerifyCodeSchema,
} from "@/lib/validations/auth";

type Step = "idle" | "reason" | "code-sent";

export function DeleteAccountSection() {
	const router = useRouter();
	const [step, setStep] = useState<Step>("idle");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [isPending, startTransition] = useTransition();

	const reasonForm = useForm<DeleteAccountInput>({
		resolver: valibotResolver(DeleteAccountSchema),
		defaultValues: { reason: "" },
	});

	const codeForm = useForm<VerifyCodeInput>({
		resolver: valibotResolver(VerifyCodeSchema),
		defaultValues: { code: "" },
	});

	async function onRequestDeletion(data: DeleteAccountInput) {
		const result = await requestAccountDeletionAction(data.reason || undefined);
		if (result.error) {
			toast.error(result.error);
		} else {
			setStep("code-sent");
			toast.success("Confirmation code sent to your email.");
		}
	}

	function onConfirmDeletion(data: VerifyCodeInput) {
		startTransition(async () => {
			const result = await confirmAccountDeletionAction(data.code);
			if (result.error) {
				toast.error(result.error);
			} else {
				router.push("/deletion-pending");
			}
		});
	}

	function onDialogClose(open: boolean) {
		if (!open) {
			setStep("idle");
			reasonForm.reset();
			codeForm.reset();
		}
		setDialogOpen(open);
	}

	return (
		<SettingsSectionCard
			icon={Delete02Icon}
			title="Delete account"
			description="Permanently delete your Scrimflow account and all associated data"
		>
			<div className="space-y-3">
				<p className="text-sm text-muted-foreground">
					Once deleted, your account and all its data — including teams, scrims, and stats — will be
					permanently removed after a 30-day grace period.
				</p>

				<AlertDialog open={dialogOpen} onOpenChange={onDialogClose}>
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10"
						>
							Delete my account
						</Button>
					</AlertDialogTrigger>

					<AlertDialogContent>
						{step === "idle" && (
							<>
								<AlertDialogHeader>
									<AlertDialogMedia className="bg-destructive/10 text-destructive">
										<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
									</AlertDialogMedia>
									<AlertDialogTitle>Delete your account?</AlertDialogTitle>
									<AlertDialogDescription>
										This will schedule your account for permanent deletion after a 30-day grace
										period. You can cancel during this period.
									</AlertDialogDescription>
								</AlertDialogHeader>
								<AlertDialogFooter>
									<AlertDialogCancel>Cancel</AlertDialogCancel>
									<Button variant="destructive" onClick={() => setStep("reason")}>
										Continue
									</Button>
								</AlertDialogFooter>
							</>
						)}

						{step === "reason" && (
							<>
								<AlertDialogHeader>
									<AlertDialogMedia className="bg-destructive/10 text-destructive">
										<HugeiconsIcon icon={Alert02Icon} strokeWidth={2} />
									</AlertDialogMedia>
									<AlertDialogTitle>Delete your account?</AlertDialogTitle>
									<AlertDialogDescription>
										This will schedule your account for permanent deletion after a 30-day grace
										period. You can cancel during this period.
									</AlertDialogDescription>
								</AlertDialogHeader>

								<form
									onSubmit={reasonForm.handleSubmit(onRequestDeletion)}
									className="space-y-3 py-2"
								>
									<Controller
										name="reason"
										control={reasonForm.control}
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid || undefined}>
												<FieldLabel htmlFor="deletion-reason" className="text-sm">
													Reason for leaving{" "}
													<span className="text-muted-foreground">(optional)</span>
												</FieldLabel>
												<Textarea
													{...field}
													id="deletion-reason"
													placeholder="Tell us why you're leaving…"
													rows={3}
													maxLength={500}
												/>
												{fieldState.invalid && <FieldError errors={[fieldState.error]} />}
											</Field>
										)}
									/>

									<AlertDialogFooter>
										<AlertDialogCancel disabled={reasonForm.formState.isSubmitting}>
											Cancel
										</AlertDialogCancel>
										<Button
											type="submit"
											variant="destructive"
											disabled={reasonForm.formState.isSubmitting}
										>
											{reasonForm.formState.isSubmitting && <Spinner className="mr-2" />}
											{reasonForm.formState.isSubmitting ? "Sending…" : "Send confirmation code"}
										</Button>
									</AlertDialogFooter>
								</form>
							</>
						)}

						{step === "code-sent" && (
							<>
								<AlertDialogHeader>
									<AlertDialogTitle>Confirm account deletion</AlertDialogTitle>
									<AlertDialogDescription>
										A confirmation code was sent to your email address. Enter it below to schedule
										your account for deletion.
									</AlertDialogDescription>
								</AlertDialogHeader>

								<form
									onSubmit={codeForm.handleSubmit(onConfirmDeletion)}
									className="space-y-3 py-2"
								>
									<Controller
										name="code"
										control={codeForm.control}
										render={({ field, fieldState }) => (
											<Field data-invalid={fieldState.invalid || undefined}>
												<FieldLabel htmlFor="deletion-code">Confirmation code</FieldLabel>
												<Input
													{...field}
													id="deletion-code"
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

									<AlertDialogFooter>
										<AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
										<Button type="submit" variant="destructive" disabled={isPending}>
											{isPending && <Spinner className="mr-2" />}
											{isPending ? "Confirming…" : "Delete my account"}
										</Button>
									</AlertDialogFooter>
								</form>
							</>
						)}
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</SettingsSectionCard>
	);
}
