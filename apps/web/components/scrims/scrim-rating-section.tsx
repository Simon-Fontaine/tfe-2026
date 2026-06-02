import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail, ScrimDisputeResolution } from "@scrimflow/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import { appRoutes } from "@/lib/routes";

function formatSignedRatingDelta(value: number) {
	return value > 0 ? `+${value}` : `${value}`;
}

function formatAlgorithmVersion(version: string) {
	return version
		.split("-")
		.map((part, index) => (index === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
		.join("-");
}

function getRatingEmptyState(
	scrimStatus: ScrimDetail["status"],
	disputeResolution?: ScrimDisputeResolution | null
): { title: string; description: string } {
	if (disputeResolution === "voided") {
		return {
			title: "No rating change",
			description: "This scrim was voided. No rating changes were applied.",
		};
	}
	if (scrimStatus === "cancelled") {
		return {
			title: "No rating change",
			description: "This scrim was cancelled before a result was confirmed.",
		};
	}
	if (scrimStatus === "disputed") {
		return {
			title: "Rating impact pending",
			description: "Ratings will be applied once the dispute is resolved.",
		};
	}
	return {
		title: "Ratings are still frozen",
		description: "The match rating only changes after both teams confirm the reported result.",
	};
}

type ChatConversation = {
	id: string;
	name: string;
	type: string;
	unreadCount: number;
	participantCount: number;
};

interface ScrimRatingOutcomeProps {
	ratingEvents: ScrimDetail["ratingEvents"];
	scrimStatus: ScrimDetail["status"];
	disputeResolution?: ScrimDisputeResolution | null;
}

export function ScrimRatingOutcome({
	ratingEvents,
	scrimStatus,
	disputeResolution,
}: ScrimRatingOutcomeProps) {
	const emptyState = getRatingEmptyState(scrimStatus, disputeResolution);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Rating outcome</CardTitle>
			</CardHeader>
			<CardContent>
				{ratingEvents.length === 0 ? (
					<div className="bg-muted/30 p-3">
						<p className="text-sm font-semibold">{emptyState.title}</p>
						<p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
					</div>
				) : (
					<div className="divide-y divide-border">
						{ratingEvents.map((event) => (
							<div
								key={event.id}
								className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
							>
								<div className="min-w-0">
									<p className="text-sm font-semibold">
										[{event.teamTag}] {event.teamName}
									</p>
									<p className="mt-1 text-xs text-muted-foreground">
										Rating {event.ratingBefore} → {event.ratingAfter}
									</p>
									<p className="mt-1 text-[10px] text-muted-foreground">
										Algorithm: {formatAlgorithmVersion(event.algorithmVersion)}
									</p>
								</div>
								<Badge
									variant="outline"
									className={
										event.ratingDelta > 0
											? STATUS_BADGE_CLASSES.ratingGain
											: event.ratingDelta < 0
												? STATUS_BADGE_CLASSES.ratingLoss
												: undefined
									}
								>
									{formatSignedRatingDelta(event.ratingDelta)}
								</Badge>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

interface ScrimChatChannelsProps {
	chatConversations: ChatConversation[];
	teamId: string;
	/**
	 * Stable entrypoint to the team chat workspace, shown when the best-effort
	 * conversation list comes back empty even though chat should exist (e.g. a
	 * transient response on a background refresh). Keeps chat reachable.
	 */
	fallbackHref?: string | null;
}

export function ScrimChatChannels({
	chatConversations,
	teamId,
	fallbackHref = null,
}: ScrimChatChannelsProps) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Chat channels</CardTitle>
			</CardHeader>
			<CardContent>
				{chatConversations.length === 0 ? (
					<div className="bg-muted/30 p-3">
						<p className="text-sm font-semibold">No scrim channels listed</p>
						<p className="mt-1 text-xs text-muted-foreground">
							Negotiation chat appears once both teams are assigned. Lobby chat appears after the
							scrim is accepted.
						</p>
						{fallbackHref ? (
							<Button asChild size="sm" variant="outline" className="mt-3">
								<Link href={fallbackHref}>Open scrim chat</Link>
							</Button>
						) : null}
					</div>
				) : (
					<div className="divide-y divide-border">
						{chatConversations.map((conversation) => (
							<div key={conversation.id} className="py-3 first:pt-0 last:pb-0">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div className="min-w-0">
										<p className="text-sm font-semibold">{conversation.name}</p>
										<p className="text-xs text-muted-foreground">
											{conversation.type === "scrim_lobby"
												? "Live match lobby for both rosters."
												: "Manager-only negotiation thread."}
										</p>
									</div>
									<Button asChild size="sm" variant="outline">
										<Link href={`${appRoutes.teams.chat(teamId)}?conversation=${conversation.id}`}>
											Open
										</Link>
									</Button>
								</div>
								<div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
									<HugeiconsIcon
										icon={MessageNotification02Icon}
										strokeWidth={2}
										className="size-3.5"
									/>
									<span>
										{conversation.unreadCount} unread · {conversation.participantCount} participant
										{conversation.participantCount === 1 ? "" : "s"}
									</span>
								</div>
							</div>
						))}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
