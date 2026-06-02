import { Calendar03Icon, Sword03Icon } from "@hugeicons/core-free-icons";
import type { ScrimDetail } from "@scrimflow/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatsGrid } from "@/components/workspace/stats-grid";
import { formatScrimTimestamp, formatSeriesFormat } from "@/lib/scrims/format";
import type { ScrimViewModel } from "@/lib/scrims/view-model";
import { ScrimStatusBadge } from "./scrim-status-badge";

function TeamColumn({
	tag,
	name,
	rating,
	archived,
	align,
}: {
	tag: string | null;
	name: string | null;
	rating: number | null;
	archived?: boolean;
	align: "start" | "end";
}) {
	return (
		<div className={align === "end" ? "min-w-0 text-right" : "min-w-0"}>
			<p className="truncate text-sm font-semibold">
				{tag ? `[${tag}] ` : ""}
				{name ?? "Open opponent"}
				{archived ? (
					<span className="ml-1 text-xs font-normal text-muted-foreground">(archived)</span>
				) : null}
			</p>
			{rating !== null ? (
				<p className="text-xs text-muted-foreground">Rating {rating}</p>
			) : (
				<p className="text-xs text-muted-foreground">No opponent yet</p>
			)}
		</div>
	);
}

export function ScrimSummaryHeader({ scrim, view }: { scrim: ScrimDetail; view: ScrimViewModel }) {
	const homeTag = scrim.homeTeamSnapshot?.tag ?? scrim.homeTeam.tag;
	const homeName = scrim.homeTeamSnapshot?.name ?? scrim.homeTeam.name;
	const awayTag = scrim.awayTeam
		? (scrim.awayTeamSnapshot?.tag ?? scrim.awayTeam.tag)
		: (scrim.awayTeamSnapshot?.tag ?? null);
	const awayName = scrim.awayTeam
		? (scrim.awayTeamSnapshot?.name ?? scrim.awayTeam.name)
		: (scrim.awayTeamSnapshot?.name ?? null);

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<ScrimStatusBadge status={scrim.status} disputeResolution={view.disputeResolution} />
						<Badge variant="outline">{view.packageState}</Badge>
					</div>

					<div className="flex items-center justify-between gap-4">
						<TeamColumn
							tag={homeTag}
							name={homeName}
							rating={scrim.homeTeam.rating}
							archived={scrim.homeTeam.isArchived}
							align="start"
						/>
						<div className="flex shrink-0 flex-col items-center">
							<p className="text-3xl font-bold tabular-nums leading-none sm:text-4xl">
								{scrim.homeMapScore}
								<span className="mx-2 text-muted-foreground">–</span>
								{scrim.awayMapScore}
							</p>
							<p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
								Series score
							</p>
						</div>
						<TeamColumn
							tag={awayTag}
							name={awayName}
							rating={scrim.awayTeam?.rating ?? null}
							archived={scrim.awayTeam?.isArchived}
							align="end"
						/>
					</div>
				</CardContent>
			</Card>

			<StatsGrid
				columns={4}
				stats={[
					{ label: "Format", value: formatSeriesFormat(scrim.config), icon: Sword03Icon },
					{
						label: scrim.startedAt ? "Started" : "Scheduled",
						value: formatScrimTimestamp(scrim.startedAt ?? scrim.scheduledAt, "Not scheduled"),
						icon: Calendar03Icon,
					},
					{ label: "Maps", value: view.reviewedMapCount },
					{
						label: "Verified stats",
						value: `${view.latestRevisionScoreboardCount}/${view.reviewedMapCount || 0}`,
					},
				]}
			/>
		</div>
	);
}
