"use client";

import { valibotResolver } from "@hookform/resolvers/valibot";
import { Alert02Icon, InformationCircleIcon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	appRoutes,
	type DeleteAccountInput,
	DeleteAccountSchema,
	type VerifyCodeInput,
	VerifyCodeSchema,
} from "@scrimflow/shared";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	cancelAccountDeletionAction,
	confirmAccountDeletionAction,
	type DeletionStatus,
	requestAccountDeletionAction,
} from "@/app/actions/settings/account-deletion";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Step = "idle" | "reason" | "code-sent";

export function DeleteAccountSection({ initialStatus }: { initialStatus: DeletionStatus }) {
	const router = useRouter();
	const [step, setStep] = useState<Step>("idle");
	const [dialogOpen, setDialogOpen] = useState(false);
	const [deletionStatus, setDeletionStatus] = useState(initialStatus);
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
				router.push(appRoutes.deletionPending);
			}
		});
	}

	function onCancelDeletion() {
		startTransition(async () => {
			const result = await cancelAccountDeletionAction();
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setDeletionStatus({
				status: "cancelled",
				isPending: false,
				scheduledAt: deletionStatus.scheduledAt,
				cancelledAt: new Date().toISOString(),
				failedAt: null,
				governanceHold: deletionStatus.governanceHold ?? null,
			});
			toast.success("Account deletion cancelled.");
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
		<div className="space-y-3">
			{deletionStatus.isPending && (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
					<p className="text-sm font-medium text-destructive">Deletion pending</p>
					<p className="text-muted-foreground text-sm">
						Your account is scheduled for deletion
						{deletionStatus.scheduledAt
							? ` on ${new Date(deletionStatus.scheduledAt).toLocaleDateString()}.`
							: "."}
					</p>
					<Button
						type="button"
						variant="outline"
						size="sm"
						className="mt-3"
						disabled={isPending}
						onClick={onCancelDeletion}
					>
						{isPending ? "Cancelling..." : "Cancel deletion"}
					</Button>
				</div>
			)}
			{deletionStatus.status === "cancelled" && (
				<p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground text-sm">
					Your last deletion request was cancelled.
				</p>
			)}
			{deletionStatus.governanceHold?.blocked &&
				deletionStatus.governanceHold.holdDetails.length > 0 && (
					<div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
						<div className="flex items-center gap-2">
							<HugeiconsIcon
								icon={InformationCircleIcon}
								className="size-4 shrink-0 text-warning"
								strokeWidth={2}
							/>
							<p className="text-sm font-medium">Transfer ownership before deleting</p>
						</div>
						<p className="mt-1 text-muted-foreground text-sm">
							You are the sole owner of the following. Transfer or disband them first.
						</p>
						<ul className="mt-2 space-y-1">
							{deletionStatus.governanceHold.holdDetails.map((hold) => (
								<li key={hold.entityId} className="text-sm">
									<Link
										href={
											hold.entityType === "team"
												? `${appRoutes.teams.settings(hold.entityId)}`
												: `${appRoutes.orgs.settings(hold.entityId)}`
										}
										className="text-primary underline-offset-2 hover:underline"
									>
										{hold.entityName}
									</Link>{" "}
									<span className="text-muted-foreground">
										({hold.entityType === "team" ? "team" : "organization"})
									</span>
								</li>
							))}
						</ul>
					</div>
				)}
			<p className="text-sm text-muted-foreground">
				Teams, scrims, ratings, and operational records are retained and attributed to an anonymized
				deleted account. Once confirmed, deletion is delayed by a 30-day grace period.
			</p>

			<AlertDialog open={dialogOpen} onOpenChange={onDialogClose}>
				{deletionStatus.governanceHold?.blocked ? (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<span className="inline-flex">
									<Button
										variant="outline"
										size="sm"
										className="pointer-events-none border-destructive/40 text-destructive hover:bg-destructive/10"
										disabled
										tabIndex={-1}
									>
										Delete my account
									</Button>
								</span>
							</TooltipTrigger>
							<TooltipContent>Transfer ownership before deleting your account.</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				) : (
					<AlertDialogTrigger asChild>
						<Button
							variant="outline"
							size="sm"
							className="border-destructive/40 text-destructive hover:bg-destructive/10"
						>
							Delete my account
						</Button>
					</AlertDialogTrigger>
				)}

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
												Reason for leaving <span className="text-muted-foreground">(optional)</span>
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

							<form onSubmit={codeForm.handleSubmit(onConfirmDeletion)} className="space-y-3 py-2">
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
	);
}
