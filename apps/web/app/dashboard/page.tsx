import { GettingStartedSection } from "@/components/dashboard/getting-started-section";
import { PageContainer } from "@/components/dashboard/page-container";
import { PageHeader } from "@/components/dashboard/page-header";
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
		<PageContainer>
			<PageHeader title="Dashboard" description={`Welcome back, ${user.displayName}`} />

			<StatsOverview stats={stats} />

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="lg:col-span-2">
					<GettingStartedSection profile={profile} />
				</div>
				{profile && <ProfileSummaryCard profile={profile} />}
			</div>
		</PageContainer>
	);
}
