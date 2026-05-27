import type { ScrimDetail, ScrimNegotiationRevisionSummary } from "@scrimflow/shared";

type LifecycleEvent = {
	id: string;
	label: string;
	actor: string | null;
	timestamp: string;
	detail?: string | null;
};

const NEGOTIATION_LABELS: Record<ScrimNegotiationRevisionSummary["action"], string> = {
	accept: "Accepted",
	cancel: "Cancelled",
	decline: "Declined",
	reschedule: "Reschedule proposed",
	propose_changes: "Terms proposed",
	expired: "Expired",
	start: "Marked in progress",
};

function formatEventTimestamp(value: string) {
	return new Intl.DateTimeFormat("en-GB", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(value));
}

function deriveLifecycleEvents(scrim: ScrimDetail): LifecycleEvent[] {
	const events: LifecycleEvent[] = [];

	events.push({
		id: "created",
		label: "Requested",
		actor: scrim.createdByDisplayName,
		timestamp: scrim.createdAt,
	});

	for (const rev of scrim.negotiationRevisions) {
		events.push({
			id: rev.id,
			label: NEGOTIATION_LABELS[rev.action] ?? rev.action,
			actor:
				rev.actorDisplayName ??
				(rev.actorTeamTag ? `[${rev.actorTeamTag}] ${rev.actorTeamName}` : null),
			timestamp: rev.createdAt,
			detail: rev.proposedScheduledAt
				? `Proposed time: ${formatEventTimestamp(rev.proposedScheduledAt)}`
				: rev.action === "cancel" && rev.proposedMessage
					? `Reason: ${rev.proposedMessage}`
					: null,
		});
	}

	for (const rev of scrim.resultRevisions) {
		events.push({
			id: rev.id,
			label: `Result reported (revision ${rev.revisionNumber})`,
			actor: rev.submittedByDisplayName ?? rev.reportingTeamName,
			timestamp: rev.createdAt,
			detail: `${rev.homeMapScore}–${rev.awayMapScore} series`,
		});
	}

	if (scrim.dispute.resolvedAt && scrim.dispute.resolution) {
		const disputeLabel =
			scrim.dispute.resolution === "voided"
				? "Scrim voided by reviewer"
				: scrim.dispute.resolution === "admin_resolved"
					? "Dispute resolved by admin"
					: "Dispute resolved";
		events.push({
			id: "dispute-resolved",
			label: disputeLabel,
			actor: scrim.dispute.resolvedByDisplayName,
			timestamp: scrim.dispute.resolvedAt,
		});
	}

	for (const event of scrim.ratingEvents) {
		events.push({
			id: event.id,
			label: "Rating applied",
			actor: event.teamName,
			timestamp: event.createdAt,
			detail: `${event.ratingDelta >= 0 ? "+" : ""}${event.ratingDelta} rating`,
		});
	}

	events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
	return events;
}

interface ScrimLifecycleTimelineProps {
	scrim: ScrimDetail;
}

export function ScrimLifecycleTimeline({ scrim }: ScrimLifecycleTimelineProps) {
	const events = deriveLifecycleEvents(scrim);
	if (events.length <= 1) return null;

	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Lifecycle history
			</p>
			<div className="mt-4 space-y-3">
				{events.map((event) => (
					<div key={event.id} className="border p-3 text-sm">
						<p className="font-semibold">{event.label}</p>
						{event.actor ? (
							<p className="mt-1 text-xs text-muted-foreground">{event.actor}</p>
						) : null}
						{event.detail ? (
							<p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
						) : null}
						<p className="mt-1 text-[11px] text-muted-foreground">
							{formatEventTimestamp(event.timestamp)}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
