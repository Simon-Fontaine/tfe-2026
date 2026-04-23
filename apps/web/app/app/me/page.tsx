import { GettingStartedSection } from "@/components/workspace/getting-started-section";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { ProfileSummaryCard } from "@/components/workspace/profile-summary-card";
import { StatsOverview } from "@/components/workspace/stats-overview";
import { getPlayerProfileFull, getPlayerStats } from "@/lib/data/player";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppMePage() {
	const { user } = await requireWorkspaceSession();

	const [profile, stats] = await Promise.all([
		getPlayerProfileFull(user.id),
		getPlayerStats(user.id),
	]);

	return (
		<PageContainer>
			<PageHeader title="Home" description={`Welcome back, ${user.displayName}`} />

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
