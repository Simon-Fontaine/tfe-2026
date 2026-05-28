import { MessageNotification02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ScrimDetail, ScrimDisputeResolution } from "@scrimflow/shared";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { appRoutes } from "@/lib/routes";

function formatSignedRatingDelta(value: number) {
	return value > 0 ? `+${value}` : `${value}`;
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

interface ScrimRatingSectionProps {
	ratingEvents: ScrimDetail["ratingEvents"];
	chatConversations: ChatConversation[];
	teamId: string;
	scrimStatus: ScrimDetail["status"];
	disputeResolution?: ScrimDisputeResolution | null;
}

export function ScrimRatingSection({
	ratingEvents,
	chatConversations,
	teamId,
	scrimStatus,
	disputeResolution,
}: ScrimRatingSectionProps) {
	return (
		<>
			<section className="border p-4">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Rating outcome
				</p>
				<div className="mt-4 space-y-3">
					{ratingEvents.length === 0
						? (() => {
								const emptyState = getRatingEmptyState(scrimStatus, disputeResolution);
								return (
									<div className="border p-3">
										<p className="text-sm font-semibold">{emptyState.title}</p>
										<p className="mt-1 text-xs text-muted-foreground">{emptyState.description}</p>
									</div>
								);
							})()
						: ratingEvents.map((event) => (
								<div key={event.id} className="border p-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<div>
											<p className="text-sm font-semibold">
												[{event.teamTag}] {event.teamName}
											</p>
											<p className="mt-1 text-xs text-muted-foreground">
												Rating {event.ratingBefore} → {event.ratingAfter}
											</p>
											<p className="mt-1 text-[10px] text-muted-foreground">
												Algorithm:{" "}
												{event.algorithmVersion
													.split("-")
													.map((part, i) =>
														i === 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part
													)
													.join("-")}
											</p>
										</div>
										<Badge
											variant={event.ratingDelta === 0 ? "outline" : "secondary"}
											className={
												event.ratingDelta > 0
													? "text-green-600"
													: event.ratingDelta < 0
														? "text-destructive"
														: undefined
											}
										>
											{formatSignedRatingDelta(event.ratingDelta)}
										</Badge>
									</div>
								</div>
							))}
				</div>
			</section>

			<section className="border p-4">
				<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
					Chat channels
				</p>
				<div className="mt-4 space-y-3">
					{chatConversations.length === 0 ? (
						<div className="border p-3">
							<p className="text-sm font-semibold">No scrim channels yet</p>
							<p className="mt-1 text-xs text-muted-foreground">
								Negotiation chat appears once both teams are assigned. Lobby chat appears after the
								scrim is accepted.
							</p>
						</div>
					) : (
						chatConversations.map((conversation) => (
							<div key={conversation.id} className="border p-3">
								<div className="flex flex-wrap items-center justify-between gap-2">
									<div>
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
								<div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
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
						))
					)}
				</div>
			</section>
		</>
	);
}
