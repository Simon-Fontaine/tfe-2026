"use client";

import type { ScrimConfirmationStatus, ScrimDetail } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiRoutes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

interface ConfirmScrimDialogProps {
	children: React.ReactNode;
	scrimId: string;
	teamId: string;
	currentStatus: ScrimConfirmationStatus;
}

export function ConfirmScrimDialog({
	children,
	scrimId,
	teamId,
	currentStatus,
}: ConfirmScrimDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [status, setStatus] = useState<"confirmed" | "disputed">(
		currentStatus === "disputed" ? "disputed" : "confirmed"
	);
	const [disputeReason, setDisputeReason] = useState("");
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	function resetState() {
		setStatus(currentStatus === "disputed" ? "disputed" : "confirmed");
		setDisputeReason("");
		setFormError(undefined);
		setFieldErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const nextFieldErrors: FormFieldErrors = {};
		if (status === "disputed" && !disputeReason.trim()) {
			nextFieldErrors.disputeReason = ["A reason is required when disputing a result."];
		}

		if (Object.keys(nextFieldErrors).length > 0) {
			setFieldErrors(nextFieldErrors);
			setFormError(undefined);
			return;
		}

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const response = await fetch(apiRoutes.scrims.confirm(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					teamId,
					status,
					disputeReason: status === "disputed" ? disputeReason.trim() : undefined,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to update scrim confirmation.");
				return;
			}

			toast.success(status === "confirmed" ? "Result confirmed." : "Dispute submitted.");
			resetState();
			setOpen(false);
			startTransition(() => {
				router.refresh();
			});
		} catch {
			setFormError("Unable to reach the API server.");
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				setOpen(nextOpen);
				if (!nextOpen) resetState();
			}}
		>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Review result confirmation</DialogTitle>
					<DialogDescription>
						Both teams should confirm the same final result before ratings are allowed to change. If
						anything is off, dispute it with a clear reason.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Decision</FieldLabel>
						<div className="grid gap-2 sm:grid-cols-2">
							<button
								type="button"
								data-selected={status === "confirmed"}
								onClick={() => {
									setStatus("confirmed");
									setFieldErrors((current) => ({ ...current, disputeReason: undefined }));
									setFormError(undefined);
								}}
								className={cn(
									"border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
								disabled={submitting}
							>
								Confirm result
							</button>
							<button
								type="button"
								data-selected={status === "disputed"}
								onClick={() => {
									setStatus("disputed");
									setFormError(undefined);
								}}
								className={cn(
									"border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive"
								)}
								disabled={submitting}
							>
								Dispute result
							</button>
						</div>
						<FieldDescription>
							Disputes should be reserved for score mismatches, evidence issues, or missing data.
						</FieldDescription>
					</Field>

					{status === "disputed" ? (
						<Field>
							<FieldLabel>Dispute reason</FieldLabel>
							<Textarea
								value={disputeReason}
								onChange={(event) => {
									setDisputeReason(event.target.value);
									setFieldErrors((current) => ({ ...current, disputeReason: undefined }));
									setFormError(undefined);
								}}
								rows={5}
								maxLength={1000}
								placeholder="Explain what is wrong with the reported result or evidence."
								disabled={submitting}
							/>
							<FieldError>{getFieldErrorText(fieldErrors, "disputeReason")}</FieldError>
						</Field>
					) : null}

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Spinner className="mr-1.5" />}
							Save decision
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							onClick={() => {
								resetState();
								setOpen(false);
							}}
							disabled={submitting}
						>
							Cancel
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
