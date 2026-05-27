"use client";

import type { ScrimNegotiationRevisionSummary } from "@scrimflow/shared";

interface ScrimNegotiationHistoryProps {
	revisions: ScrimNegotiationRevisionSummary[];
}

const ACTION_LABELS: Record<ScrimNegotiationRevisionSummary["action"], string> = {
	accept: "Accepted",
	cancel: "Cancelled",
	decline: "Declined",
	reschedule: "Reschedule proposed",
	propose_changes: "Terms proposed",
	expired: "Expired",
	start: "Marked in progress",
};

export function ScrimNegotiationHistory({ revisions }: ScrimNegotiationHistoryProps) {
	if (revisions.length === 0) return null;

	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Negotiation history
			</p>
			<div className="mt-4 space-y-3">
				{revisions.map((rev) => (
					<div key={rev.id} className="border p-3 text-sm">
						<p className="font-semibold">{ACTION_LABELS[rev.action]}</p>
						{rev.actorTeamName ? (
							<p className="mt-1 text-xs text-muted-foreground">
								[{rev.actorTeamTag}] {rev.actorTeamName}
								{rev.actorDisplayName ? ` · ${rev.actorDisplayName}` : ""}
							</p>
						) : null}
						{rev.priorScheduledAt ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Previous time: {new Date(rev.priorScheduledAt).toLocaleString()}
							</p>
						) : null}
						{rev.proposedScheduledAt ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Proposed time: {new Date(rev.proposedScheduledAt).toLocaleString()}
							</p>
						) : null}
						{rev.priorConfig?.bestOf !== undefined &&
						rev.proposedConfig?.bestOf !== undefined &&
						rev.priorConfig.bestOf !== rev.proposedConfig.bestOf ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Best of: {rev.priorConfig.bestOf} → {rev.proposedConfig.bestOf}
							</p>
						) : rev.proposedConfig?.bestOf !== undefined ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Best of: {rev.proposedConfig.bestOf}
							</p>
						) : null}
						{rev.proposedConfig?.format ? (
							<p className="mt-1 text-xs text-muted-foreground">
								Format: {rev.proposedConfig.format}
							</p>
						) : null}
						{rev.proposedMessage ? (
							<p className="mt-1 text-xs text-muted-foreground">
								{rev.action === "cancel" ? "Reason" : "Message"}: {rev.proposedMessage}
							</p>
						) : null}
						<p className="mt-1 text-[11px] text-muted-foreground">
							{new Date(rev.createdAt).toLocaleString()}
						</p>
					</div>
				))}
			</div>
		</section>
	);
}
