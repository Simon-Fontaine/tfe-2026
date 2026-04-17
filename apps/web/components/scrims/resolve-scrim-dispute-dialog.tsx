"use client";

import type { ScrimDetail } from "@scrimflow/shared";
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

type ResolutionAction = "confirm_reported_result" | "void_scrim";

interface ResolveScrimDisputeDialogProps {
	children: React.ReactNode;
	scrimId: string;
}

export function ResolveScrimDisputeDialog({ children, scrimId }: ResolveScrimDisputeDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [action, setAction] = useState<ResolutionAction>("confirm_reported_result");
	const [notes, setNotes] = useState("");
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	function resetState() {
		setAction("confirm_reported_result");
		setNotes("");
		setFormError(undefined);
		setFieldErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		setSubmitting(true);
		setFormError(undefined);
		setFieldErrors({});

		try {
			const response = await fetch(apiRoutes.scrims.resolveDispute(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					action,
					notes: notes.trim() || undefined,
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to resolve the scrim dispute.");
				return;
			}

			toast.success(
				action === "confirm_reported_result"
					? "Dispute resolved and rating finalized."
					: "Dispute resolved and scrim voided."
			);
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
					<DialogTitle>Resolve scrim dispute</DialogTitle>
					<DialogDescription>
						Org-level dispute resolution is final. Either finalize the currently reported result and
						apply ratings, or void the scrim entirely.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Resolution action</FieldLabel>
						<div className="grid gap-2">
							<button
								type="button"
								data-selected={action === "confirm_reported_result"}
								onClick={() => {
									setAction("confirm_reported_result");
									setFormError(undefined);
								}}
								className={cn(
									"border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-primary data-[selected=true]:bg-primary/10 data-[selected=true]:text-primary"
								)}
								disabled={submitting}
							>
								Finalize the reported result
								<p className="mt-1 text-[11px] font-normal text-muted-foreground">
									Keep the current scoreline, complete the scrim, and apply team rating changes.
								</p>
							</button>
							<button
								type="button"
								data-selected={action === "void_scrim"}
								onClick={() => {
									setAction("void_scrim");
									setFormError(undefined);
								}}
								className={cn(
									"border px-3 py-3 text-left text-xs font-medium transition-colors hover:bg-muted",
									"data-[selected=true]:border-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive"
								)}
								disabled={submitting}
							>
								Void the scrim
								<p className="mt-1 text-[11px] font-normal text-muted-foreground">
									Cancel the disputed scrim and keep ratings frozen.
								</p>
							</button>
						</div>
						<FieldDescription>
							Use notes to explain why the disputed result was finalized or why the scrim was
							voided.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel>Resolution notes</FieldLabel>
						<Textarea
							value={notes}
							onChange={(event) => {
								setNotes(event.target.value);
								setFieldErrors((current) => ({ ...current, notes: undefined }));
								setFormError(undefined);
							}}
							rows={5}
							maxLength={1000}
							placeholder="Summarize the decision, evidence review, or reason for voiding the match."
							disabled={submitting}
						/>
						<FieldError>{getFieldErrorText(fieldErrors, "notes")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Spinner className="mr-1.5" />}
							Resolve dispute
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
