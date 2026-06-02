import {
	Add01Icon,
	Alert01Icon,
	Calendar03Icon,
	Cancel01Icon,
	ChartLineData01Icon,
	CheckmarkCircle01Icon,
	Flag01Icon,
	MessageNotification02Icon,
	Sword03Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail, ScrimNegotiationRevisionSummary } from "@scrimflow/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScrimTimestamp } from "@/lib/scrims/format";
import { cn } from "@/lib/utils";

type EventTone = "neutral" | "positive" | "negative";

type LifecycleEvent = {
	id: string;
	label: string;
	actor: string | null;
	timestamp: string;
	detail?: string | null;
	icon: IconSvgElement;
	tone: EventTone;
};

const NEGOTIATION_META: Record<
	ScrimNegotiationRevisionSummary["action"],
	{ label: string; icon: IconSvgElement; tone: EventTone }
> = {
	accept: { label: "Accepted", icon: CheckmarkCircle01Icon, tone: "positive" },
	cancel: { label: "Cancelled", icon: Cancel01Icon, tone: "negative" },
	decline: { label: "Declined", icon: Cancel01Icon, tone: "negative" },
	reschedule: { label: "Reschedule proposed", icon: Calendar03Icon, tone: "neutral" },
	propose_changes: { label: "Terms proposed", icon: Calendar03Icon, tone: "neutral" },
	expired: { label: "Expired", icon: Cancel01Icon, tone: "negative" },
	start: { label: "Marked in progress", icon: Sword03Icon, tone: "neutral" },
};

function deriveLifecycleEvents(scrim: ScrimDetail): LifecycleEvent[] {
	const events: LifecycleEvent[] = [];

	events.push({
		id: "created",
		label: "Requested",
		actor: scrim.createdByDisplayName,
		timestamp: scrim.createdAt,
		icon: Add01Icon,
		tone: "neutral",
	});

	for (const rev of scrim.negotiationRevisions) {
		const meta = NEGOTIATION_META[rev.action] ?? {
			label: rev.action,
			icon: Calendar03Icon,
			tone: "neutral" as const,
		};
		events.push({
			id: rev.id,
			label: meta.label,
			icon: meta.icon,
			tone: meta.tone,
			actor:
				rev.actorDisplayName ??
				(rev.actorTeamTag ? `[${rev.actorTeamTag}] ${rev.actorTeamName}` : null),
			timestamp: rev.createdAt,
			detail: rev.proposedScheduledAt
				? `Proposed time: ${formatScrimTimestamp(rev.proposedScheduledAt)}`
				: rev.action === "cancel" && rev.proposedMessage
					? `Reason: ${rev.proposedMessage}`
					: rev.proposedMessage
						? `Note: ${rev.proposedMessage}`
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
			icon: Flag01Icon,
			tone: "neutral",
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
				icon: Alert01Icon,
				tone: "negative",
			});
		}
	}

	if (scrim.dispute.disputeRespondedAt) {
		events.push({
			id: "dispute-response",
			label: "Dispute response submitted",
			actor: scrim.dispute.disputeRespondedByDisplayName,
			timestamp: scrim.dispute.disputeRespondedAt,
			detail: scrim.dispute.disputeResponse,
			icon: MessageNotification02Icon,
			tone: "neutral",
		});
	}

	if (scrim.dispute.resolvedAt && scrim.dispute.resolution) {
		const voided = scrim.dispute.resolution === "voided";
		events.push({
			id: "dispute-resolved",
			label: voided
				? "Scrim voided by reviewer"
				: scrim.dispute.resolution === "admin_resolved"
					? "Dispute resolved by admin"
					: "Dispute resolved",
			actor: scrim.dispute.resolvedByDisplayName,
			timestamp: scrim.dispute.resolvedAt,
			detail: scrim.dispute.notes,
			icon: voided ? Cancel01Icon : CheckmarkCircle01Icon,
			tone: voided ? "negative" : "positive",
		});
	}

	for (const event of scrim.ratingEvents) {
		events.push({
			id: event.id,
			label: "Rating applied",
			actor: `[${event.teamTag}] ${event.teamName}`,
			timestamp: event.createdAt,
			detail: `${event.ratingDelta >= 0 ? "+" : ""}${event.ratingDelta} rating (${event.ratingBefore} → ${event.ratingAfter})`,
			icon: ChartLineData01Icon,
			tone: event.ratingDelta >= 0 ? "positive" : "negative",
		});
	}

	events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
	return events;
}

const STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function getStaleLifecycleCue(scrim: ScrimDetail): string | null {
	if (scrim.status === "awaiting_confirmation" && scrim.endedAt) {
		const elapsed = Date.now() - new Date(scrim.endedAt).getTime();
		if (elapsed > STALE_THRESHOLD_MS) {
			return "Awaiting opponent confirmation for more than 48 hours.";
		}
	}
	if (scrim.status === "disputed" && !scrim.dispute.resolution) {
		return "Disputed — pending admin review.";
	}
	return null;
}

const TONE_ICON_CLASSES: Record<EventTone, string> = {
	neutral: "bg-muted text-muted-foreground",
	positive: "bg-green-600/10 text-green-600",
	negative: "bg-destructive/10 text-destructive",
};

export function ScrimActivityFeed({ scrim }: { scrim: ScrimDetail }) {
	const events = deriveLifecycleEvents(scrim);
	const staleCue = getStaleLifecycleCue(scrim);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Activity timeline</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{staleCue ? (
					<Alert className="border-amber-500/40 bg-amber-500/10">
						<HugeiconsIcon icon={Alert01Icon} strokeWidth={2} className="text-amber-600" />
						<AlertTitle className="text-amber-700 dark:text-amber-400">Needs attention</AlertTitle>
						<AlertDescription className="text-amber-700/90 dark:text-amber-400/90">
							{staleCue}
						</AlertDescription>
					</Alert>
				) : null}

				<ol>
					{events.map((event, index) => (
						<li key={event.id} className="relative flex gap-3 pb-4 last:pb-0">
							{index < events.length - 1 ? (
								<span className="absolute top-7 bottom-0 left-3.5 w-px bg-border" aria-hidden />
							) : null}
							<span
								className={cn(
									"relative z-10 flex size-7 shrink-0 items-center justify-center",
									TONE_ICON_CLASSES[event.tone]
								)}
							>
								<HugeiconsIcon icon={event.icon} strokeWidth={2} className="size-3.5" />
							</span>
							<div className="min-w-0 pt-0.5">
								<p className="text-sm font-medium">{event.label}</p>
								{event.actor ? (
									<p className="text-xs text-muted-foreground">{event.actor}</p>
								) : null}
								{event.detail ? (
									<p className="mt-0.5 text-xs text-muted-foreground">{event.detail}</p>
								) : null}
								<p className="mt-0.5 text-[11px] text-muted-foreground">
									{formatScrimTimestamp(event.timestamp)}
								</p>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
