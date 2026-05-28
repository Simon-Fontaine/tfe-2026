"use client";

import { Flag01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ReportTargetType } from "@scrimflow/shared";
import { useState } from "react";
import { submitReportAction } from "@/app/actions/report";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useFormAction } from "@/hooks/use-form-action";

const REPORT_CATEGORIES = [
	{ value: "harassment", label: "Harassment" },
	{ value: "spam", label: "Spam" },
	{ value: "impersonation", label: "Impersonation" },
	{ value: "abuse", label: "Abuse" },
	{ value: "evidence_manipulation", label: "Evidence manipulation" },
	{ value: "dispute_abuse", label: "Dispute abuse" },
	{ value: "suspicious_recruiting", label: "Suspicious recruiting" },
	{ value: "other", label: "Other" },
] as const;

interface ReportDialogProps {
	targetType: ReportTargetType;
	targetId: string;
	targetDisplayName?: string;
	/** Trigger slot. Omit when using controlled `open`/`onOpenChange`. */
	children?: React.ReactNode;
	/** Controlled open state. When provided, internal state is ignored. */
	open?: boolean;
	/** Controlled open state setter. Required when `open` is provided. */
	onOpenChange?: (open: boolean) => void;
}

export function ReportDialog({
	targetType,
	targetId,
	targetDisplayName,
	children,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
}: ReportDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const setOpen = isControlled ? (controlledOnOpenChange ?? (() => {})) : setInternalOpen;

	const [category, setCategory] = useState("");
	const [reason, setReason] = useState("");

	const { state, submit, isPending } = useFormAction(submitReportAction, {
		loadingMessage: "Submitting report…",
		successMessage: "Report submitted",
	});

	function handleReset() {
		setCategory("");
		setReason("");
		setOpen(false);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			{children ? <DialogTrigger asChild>{children}</DialogTrigger> : null}
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						<span className="flex items-center gap-2">
							<HugeiconsIcon icon={Flag01Icon} size={16} />
							Report {targetDisplayName ? `"${targetDisplayName}"` : targetType}
						</span>
					</DialogTitle>
				</DialogHeader>

				{state?.success ? (
					<div className="space-y-4">
						<p className="text-sm">
							Your report has been submitted. We will review it according to our governance policy.
						</p>
						{state.reportId ? (
							<p className="text-xs text-muted-foreground">
								Case reference: <span className="font-mono">{state.reportId}</span> — status:{" "}
								{state.reportStatus ?? "pending"}
							</p>
						) : null}
						<Button type="button" variant="outline" onClick={handleReset}>
							Close
						</Button>
					</div>
				) : (
					<form action={submit} className="space-y-4">
						<input type="hidden" name="targetType" value={targetType} />
						<input type="hidden" name="targetId" value={targetId} />

						<Field>
							<FieldLabel required>Category</FieldLabel>
							<select
								name="category"
								value={category}
								onChange={(e) => setCategory(e.target.value)}
								required
								className="w-full border bg-background px-3 py-2 text-sm"
							>
								<option value="" disabled>
									Select a category…
								</option>
								{REPORT_CATEGORIES.map((cat) => (
									<option key={cat.value} value={cat.value}>
										{cat.label}
									</option>
								))}
							</select>
						</Field>

						<Field>
							<FieldLabel required>Describe the issue</FieldLabel>
							<Textarea
								name="reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								placeholder="Describe what happened and why you are reporting this."
								maxLength={1000}
								rows={4}
								required
								minLength={10}
							/>
							<p className="text-right text-[11px] text-muted-foreground">{reason.length}/1000</p>
						</Field>

						{state?.error && <p className="text-sm text-destructive">{state.error}</p>}

						<div className="flex justify-end gap-2">
							<Button type="button" variant="ghost" onClick={() => setOpen(false)}>
								Cancel
							</Button>
							<Button type="submit" disabled={isPending || !category || reason.trim().length < 10}>
								{isPending ? <Spinner className="size-4" /> : "Submit report"}
							</Button>
						</div>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
