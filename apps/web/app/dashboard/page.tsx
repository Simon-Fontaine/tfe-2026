import { GettingStartedSection } from "@/components/dashboard/getting-started-section";
import { ProfileSummaryCard } from "@/components/dashboard/profile-summary-card";
import { StatsOverview } from "@/components/dashboard/stats-overview";
import { getCurrentSession } from "@/lib/auth/session";
import { getPlayerProfileFull, getPlayerStats } from "@/lib/data/player";

export default async function DashboardPage() {
	const { user } = await getCurrentSession();
	if (!user) return null; // layout guard ensures this never happens
	const userId = user.id;

	const [profile, stats] = await Promise.all([
		getPlayerProfileFull(userId),
		getPlayerStats(userId),
	]);

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
			<div>
				<h1 className="text-lg font-bold">Dashboard</h1>
				<p className="text-xs text-muted-foreground">Welcome back, {user.displayName}</p>
			</div>

			<StatsOverview stats={stats} />

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<GettingStartedSection profile={profile} />
				</div>
				{profile && <ProfileSummaryCard profile={profile} />}
			</div>
		</div>
	);
}
