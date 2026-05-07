import type { ScrimDetail } from "@scrimflow/shared";

function formatTimestamp(value: string | null, emptyLabel = "Not set") {
	return value
		? new Intl.DateTimeFormat("en-GB", {
				dateStyle: "medium",
				timeStyle: "short",
			}).format(new Date(value))
		: emptyLabel;
}

interface ScrimSeriesOverviewProps {
	config: ScrimDetail["config"];
	homeMapScore: number;
	awayMapScore: number;
	scheduledAt: string | null;
	startedAt: string | null;
	endedAt: string | null;
	createdByDisplayName: string | null;
	pendingConfirmationCount: number;
}

export function ScrimSeriesOverview({
	config,
	homeMapScore,
	awayMapScore,
	scheduledAt,
	startedAt,
	endedAt,
	createdByDisplayName,
	pendingConfirmationCount,
}: ScrimSeriesOverviewProps) {
	return (
		<section className="border p-4">
			<p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
				Series overview
			</p>
			<div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
				<div className="space-y-1 border p-3">
					<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Series score</p>
					<p className="text-sm font-semibold">
						{homeMapScore} - {awayMapScore}
					</p>
				</div>
				<div className="space-y-1 border p-3">
					<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
						Preferred start
					</p>
					<p className="text-sm font-semibold">{formatTimestamp(scheduledAt, "Not scheduled")}</p>
				</div>
				<div className="space-y-1 border p-3">
					<p className="text-[11px] uppercase tracking-wide text-muted-foreground">
						Reported start
					</p>
					<p className="text-sm font-semibold">{formatTimestamp(startedAt, "Not reported")}</p>
				</div>
				<div className="space-y-1 border p-3">
					<p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reported end</p>
					<p className="text-sm font-semibold">{formatTimestamp(endedAt, "Not reported")}</p>
				</div>
			</div>

			<div className="mt-4 flex flex-wrap gap-2">
				<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
					Format: {config.format ?? `Best of ${config.bestOf ?? 5}`}
				</span>
				<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
					Created by: {createdByDisplayName ?? "Unknown manager"}
				</span>
				<span className="inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-semibold">
					{pendingConfirmationCount} confirmation step(s) open
				</span>
			</div>
		</section>
	);
}
