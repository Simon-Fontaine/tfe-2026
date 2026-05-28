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

	for (const confirmation of scrim.confirmations) {
		if (confirmation.status === "disputed" && confirmation.confirmedAt) {
			events.push({
				id: `dispute-raised-${confirmation.id}`,
				label: "Dispute raised",
				actor:
					confirmation.confirmedByDisplayName ??
					`[${confirmation.teamTag}] ${confirmation.teamName}`,
				timestamp: confirmation.confirmedAt,
				detail: confirmation.disputeReason ? `Reason: ${confirmation.disputeReason}` : null,
			});
		}
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

	if (scrim.dispute.disputeRespondedAt) {
		events.push({
			id: "dispute-response",
			label: "Dispute response submitted",
			actor: scrim.dispute.disputeRespondedByDisplayName,
			timestamp: scrim.dispute.disputeRespondedAt,
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

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function getStaleLifecycleCue(scrim: ScrimDetail): string | null {
	if (scrim.status === "awaiting_confirmation" && scrim.endedAt) {
		const elapsed = Date.now() - new Date(scrim.endedAt).getTime();
		if (elapsed > STALE_THRESHOLD_MS) {
			return "Pending confirmation — awaiting opponent response";
		}
	}
	if (scrim.status === "disputed" && !scrim.dispute.resolution) {
		return "Disputed — pending admin review";
	}
	return null;
}

export function ScrimLifecycleTimeline({ scrim }: ScrimLifecycleTimelineProps) {
	const events = deriveLifecycleEvents(scrim);
	const staleLifecycleCue = getStaleLifecycleCue(scrim);
	if (events.length <= 1 && !staleLifecycleCue) return null;

	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Lifecycle history
			</p>
			{staleLifecycleCue ? (
				<p className="mt-3 rounded-sm border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
					{staleLifecycleCue}
				</p>
			) : null}
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
