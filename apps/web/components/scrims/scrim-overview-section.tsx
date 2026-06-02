import type { ScrimDetail } from "@scrimflow/shared";
import Link from "next/link";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatScrimTimestamp, formatSeriesFormat } from "@/lib/scrims/format";
import type { ScrimViewModel } from "@/lib/scrims/view-model";
import { ScrimChatChannels, ScrimRatingOutcome } from "./scrim-rating-section";

interface ScrimOverviewSectionProps {
	scrim: ScrimDetail;
	view: ScrimViewModel;
	teamId: string;
	teamTag: string;
	teamName: string;
	canManage: boolean;
	chatConversations: ComponentProps<typeof ScrimChatChannels>["chatConversations"];
	chatFallbackHref: string | null;
	scrimQueueHref: string;
}

function TeamPanel({
	label,
	tag,
	name,
	rating,
	archived,
	unavailable,
}: {
	label: string;
	tag: string | null;
	name: string | null;
	rating: number | null;
	archived?: boolean;
	unavailable?: boolean;
}) {
	return (
		<div className="bg-muted/30 p-3">
			<p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
			<p className="mt-1 text-sm font-semibold">
				{name ? `${tag ? `[${tag}] ` : ""}${name}` : "No opponent assigned yet"}
				{archived ? (
					<span className="ml-1 text-xs font-normal text-muted-foreground">(archived)</span>
				) : null}
				{unavailable ? (
					<span className="ml-1 text-xs font-normal text-muted-foreground">
						(no longer available)
					</span>
				) : null}
			</p>
			{rating !== null ? (
				<p className="mt-1 text-xs text-muted-foreground">Rating {rating}</p>
			) : null}
		</div>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-right text-xs font-medium">{value}</span>
		</div>
	);
}

export function ScrimOverviewSection({
	scrim,
	view,
	teamId,
	teamTag,
	teamName,
	canManage,
	chatConversations,
	chatFallbackHref,
	scrimQueueHref,
}: ScrimOverviewSectionProps) {
	const awayUnavailable = !scrim.awayTeam && !!scrim.awayTeamSnapshot;

	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Teams</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid gap-3 sm:grid-cols-2">
						<TeamPanel
							label="Home"
							tag={scrim.homeTeamSnapshot?.tag ?? scrim.homeTeam.tag}
							name={scrim.homeTeamSnapshot?.name ?? scrim.homeTeam.name}
							rating={scrim.homeTeam.rating}
							archived={scrim.homeTeam.isArchived}
						/>
						<TeamPanel
							label="Away"
							tag={scrim.awayTeamSnapshot?.tag ?? scrim.awayTeam?.tag ?? null}
							name={scrim.awayTeamSnapshot?.name ?? scrim.awayTeam?.name ?? null}
							rating={scrim.awayTeam?.rating ?? null}
							archived={scrim.awayTeam?.isArchived}
							unavailable={awayUnavailable}
						/>
					</div>
					<p className="text-xs text-muted-foreground">
						Viewing from [{teamTag}] {teamName} as {canManage ? "a manager" : "a member"}.
					</p>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Match details</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="divide-y divide-border">
						<DetailRow label="Format" value={formatSeriesFormat(scrim.config)} />
						<DetailRow
							label="Scheduled"
							value={formatScrimTimestamp(scrim.scheduledAt, "Not scheduled")}
						/>
						<DetailRow label="Started" value={formatScrimTimestamp(scrim.startedAt)} />
						<DetailRow label="Ended" value={formatScrimTimestamp(scrim.endedAt)} />
						<DetailRow label="Created by" value={scrim.createdByDisplayName ?? "Unknown manager"} />
					</div>
				</CardContent>
			</Card>

			<ScrimRatingOutcome
				ratingEvents={scrim.ratingEvents}
				scrimStatus={scrim.status}
				disputeResolution={view.disputeResolution}
			/>

			<ScrimChatChannels
				chatConversations={chatConversations}
				teamId={teamId}
				fallbackHref={chatFallbackHref}
			/>

			{scrim.status === "cancelled" && canManage ? (
				<Card className="lg:col-span-2">
					<CardHeader>
						<CardTitle>Schedule recovery</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-sm text-muted-foreground">
							This scrim was cancelled. Request a new scrim from the queue to play again.
						</p>
						<Button asChild size="sm" variant="outline">
							<Link href={scrimQueueHref}>Go to scrim queue</Link>
						</Button>
					</CardContent>
				</Card>
			) : null}
		</div>
	);
}
