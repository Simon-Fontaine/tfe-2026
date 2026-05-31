import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { STATUS_BADGE_CLASSES } from "@/lib/badge-classes";
import type { NotificationSummary } from "@/lib/data/notifications";
import type { UserTeam } from "@/lib/data/player";

interface RecentScrimItem {
	teamName: string;
	opponentName: string;
	result: "win" | "loss" | "draw" | null;
	date: string; // ISO string
}

interface ActivityFeedSectionProps {
	teams: UserTeam[];
	recentNotifications: NotificationSummary[];
	recentScrims: RecentScrimItem[];
}

function resultBadge(result: RecentScrimItem["result"]) {
	if (result === "win")
		return (
			<Badge variant="outline" className={STATUS_BADGE_CLASSES.win}>
				Win
			</Badge>
		);
	if (result === "loss")
		return (
			<Badge variant="outline" className={STATUS_BADGE_CLASSES.loss}>
				Loss
			</Badge>
		);
	return (
		<Badge variant="outline" className={STATUS_BADGE_CLASSES.draw}>
			Draw
		</Badge>
	);
}

export function ActivityFeedSection({
	teams: _teams,
	recentNotifications,
	recentScrims,
}: ActivityFeedSectionProps) {
	const allEmpty = recentScrims.length === 0 && recentNotifications.length === 0;

	if (allEmpty) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle>Recent Activity</CardTitle>
				</CardHeader>
				<CardContent>
					<Empty>
						<EmptyHeader>
							<EmptyTitle>Nothing yet</EmptyTitle>
							<EmptyDescription>
								Your recent scrims, notifications, and availability will appear here once your teams
								get active.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle>Recent Activity</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Recent Scrims */}
				<div>
					<p className="text-sm font-semibold mb-2">Recent Scrims</p>
					{recentScrims.length === 0 ? (
						<p className="text-sm text-muted-foreground">No recent scrims</p>
					) : (
						recentScrims.map((scrim, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static list with no reordering
								key={i}
								className="flex items-center justify-between py-2 text-sm"
							>
								<span>
									{scrim.teamName} vs {scrim.opponentName}
								</span>
								<div className="flex items-center gap-2">
									{resultBadge(scrim.result)}
									<span className="text-xs text-muted-foreground">
										{new Date(scrim.date).toLocaleDateString()}
									</span>
								</div>
							</div>
						))
					)}
				</div>

				<Separator />

				{/* Notifications */}
				<div>
					<p className="text-sm font-semibold mb-2">Notifications</p>
					{recentNotifications.length === 0 ? (
						<p className="text-sm text-muted-foreground">No recent notifications</p>
					) : (
						recentNotifications.map((notification) => (
							<div key={notification.id} className="flex items-center justify-between py-2 text-sm">
								<span>{notification.title}</span>
								<span className="text-xs text-muted-foreground">
									{new Date(notification.createdAt).toLocaleDateString()}
								</span>
							</div>
						))
					)}
				</div>

				<Separator />

				{/* Upcoming Availability */}
				{/* Phase 18: availability feed stub — requires per-team availability fetch in future phase */}
				<div>
					<p className="text-sm font-semibold mb-2">Upcoming Availability</p>
					<p className="text-sm text-muted-foreground">No upcoming availability set</p>
				</div>
			</CardContent>
		</Card>
	);
}
