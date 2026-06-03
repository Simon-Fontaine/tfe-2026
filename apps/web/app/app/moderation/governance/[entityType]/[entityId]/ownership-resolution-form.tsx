"use client";

import { appRoutes } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { resolveOwnershipByModeratorAction } from "@/app/actions/moderation/governance";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

interface OwnershipResolutionFormProps {
	workflowId: string;
}

export function OwnershipResolutionForm({ workflowId }: OwnershipResolutionFormProps) {
	const router = useRouter();
	const [action, setAction] = useState<"approve" | "reject">("approve");
	const [reason, setReason] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (reason.trim().length < 10) {
			toast.error("Reason must be at least 10 characters.");
			return;
		}
		setLoading(true);
		try {
			const result = await resolveOwnershipByModeratorAction(workflowId, {
				action,
				reason: reason.trim(),
			});
			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success(
					action === "approve" ? "Ownership workflow approved." : "Ownership workflow rejected."
				);
				router.push(appRoutes.moderation.governance.root);
			}
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-4">
			<RadioGroup
				value={action}
				onValueChange={(val) => setAction(val as "approve" | "reject")}
				className="flex gap-4"
			>
				<div className="flex items-center gap-2">
					<RadioGroupItem value="approve" id="action-approve" />
					<Label htmlFor="action-approve" className="cursor-pointer">
						Approve
					</Label>
				</div>
				<div className="flex items-center gap-2">
					<RadioGroupItem value="reject" id="action-reject" />
					<Label htmlFor="action-reject" className="cursor-pointer">
						Reject
					</Label>
				</div>
			</RadioGroup>

			<div className="space-y-2">
				<Label htmlFor="resolution-reason">Reason (required)</Label>
				<Textarea
					id="resolution-reason"
					value={reason}
					onChange={(e) => setReason(e.target.value)}
					placeholder="Explain the governance decision (min 10 characters)..."
					rows={4}
					minLength={10}
					maxLength={2000}
					required
				/>
			</div>

			<div className="flex gap-2">
				{action === "approve" ? (
					<Button type="submit" disabled={loading}>
						{loading ? "Approving…" : "Approve Recovery"}
					</Button>
				) : (
					<Button type="submit" variant="destructive" disabled={loading}>
						{loading ? "Rejecting…" : "Reject Recovery"}
					</Button>
				)}
			</div>
		</form>
	);
}
