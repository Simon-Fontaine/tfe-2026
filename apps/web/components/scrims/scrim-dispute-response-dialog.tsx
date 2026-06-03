"use client";

import type { ScrimDetail } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { type FormFieldErrors, getFieldErrorText, readApiPayload } from "./form-errors";

interface ScrimDisputeResponseDialogProps {
	children: React.ReactNode;
	scrimId: string;
	reportingTeamId: string;
}

export function ScrimDisputeResponseDialog({
	children,
	scrimId,
	reportingTeamId,
}: ScrimDisputeResponseDialogProps) {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [responseText, setResponseText] = useState("");
	const [formError, setFormError] = useState<string | undefined>(undefined);
	const [fieldErrors, setFieldErrors] = useState<FormFieldErrors>({});
	const [submitting, setSubmitting] = useState(false);

	function resetState() {
		setResponseText("");
		setFormError(undefined);
		setFieldErrors({});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (submitting) return;

		const nextFieldErrors: FormFieldErrors = {};
		if (!responseText.trim()) {
			nextFieldErrors.responseText = ["A response is required."];
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
			const response = await fetch(apiRoutes.scrims.disputeRespond(scrimId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					reportingTeamId,
					responseText: responseText.trim(),
				}),
			});
			const payload = await readApiPayload<ScrimDetail>(response);

			if (!response.ok || !payload.data) {
				setFieldErrors(payload.fieldErrors ?? {});
				setFormError(payload.error ?? "Unable to submit dispute response.");
				return;
			}

			toast.success("Dispute response submitted.");
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
					<DialogTitle>Respond to dispute</DialogTitle>
					<DialogDescription>
						Provide a clarification or acknowledgement to the opponent's dispute. Both teams will
						see this response before an org admin resolves the dispute.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Field>
						<FieldLabel>Response</FieldLabel>
						<Textarea
							value={responseText}
							onChange={(event) => {
								setResponseText(event.target.value);
								setFieldErrors((current) => ({ ...current, responseText: undefined }));
								setFormError(undefined);
							}}
							rows={5}
							maxLength={1000}
							placeholder="Explain or acknowledge the dispute raised by the opponent."
							disabled={submitting}
						/>
						<FieldError>{getFieldErrorText(fieldErrors, "responseText")}</FieldError>
					</Field>

					{formError ? <p className="text-xs text-destructive">{formError}</p> : null}

					<div className="flex gap-2">
						<Button type="submit" size="sm" disabled={submitting}>
							{submitting && <Spinner className="mr-1.5" />}
							Submit response
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
