import type { ScrimDisputeResolution, ScrimStatus } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SCRIM_STATUS_LABELS: Record<ScrimStatus, string> = {
	pending: "Pending",
	accepted: "Accepted",
	scheduled: "Scheduled",
	in_progress: "In progress",
	awaiting_confirmation: "Awaiting confirmation",
	completed: "Completed",
	cancelled: "Cancelled",
	disputed: "Disputed",
};

export function ScrimStatusBadge({
	status,
	disputeResolution,
}: {
	status: ScrimStatus;
	disputeResolution?: ScrimDisputeResolution | null;
}) {
	if (status === "cancelled" && disputeResolution === "voided") {
		return (
			<Badge variant="outline" className="text-muted-foreground">
				Voided
			</Badge>
		);
	}

	if (status === "disputed") {
		return <Badge variant="destructive">{SCRIM_STATUS_LABELS[status]}</Badge>;
	}

	if (status === "completed") {
		return <Badge variant="secondary">{SCRIM_STATUS_LABELS[status]}</Badge>;
	}

	return (
		<Badge variant="outline" className={cn(status === "cancelled" && "text-muted-foreground")}>
			{SCRIM_STATUS_LABELS[status]}
		</Badge>
	);
}
