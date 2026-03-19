import { Card, CardContent } from "@/components/ui/card";
import type { PlayerStats } from "@/lib/data/player";

interface StatCardProps {
	label: string;
	value: string | number;
	footnote: string;
}

function StatCard({ label, value, footnote }: StatCardProps) {
	return (
		<Card>
			<CardContent className="pt-5">
				<p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
					{label}
				</p>
				<p className="mt-1 text-2xl font-bold">{value}</p>
				<p className="mt-1 text-[10px] text-muted-foreground">{footnote}</p>
			</CardContent>
		</Card>
	);
}

interface StatsOverviewProps {
	stats: PlayerStats;
}

export function StatsOverview({ stats }: StatsOverviewProps) {
	const winRate = stats.scrimsPlayed > 0 ? Math.round((stats.wins / stats.scrimsPlayed) * 100) : 0;

	return (
		<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
			<StatCard
				label="Internal SR"
				value={stats.sr.toLocaleString()}
				footnote="Updates after scrim confirmation"
			/>
			<StatCard
				label="Scrims played"
				value={stats.scrimsPlayed}
				footnote="Counted after both teams confirm"
			/>
			<StatCard
				label="Win rate"
				value={`${winRate}%`}
				footnote="Based on confirmed scrim results"
			/>
		</div>
	);
}
