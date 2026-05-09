import { ActivityFeedSection } from "@/components/workspace/activity-feed-section";
import { GettingStartedSection } from "@/components/workspace/getting-started-section";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { ProfileSummaryCard } from "@/components/workspace/profile-summary-card";
import { StatsOverview } from "@/components/workspace/stats-overview";
import { getNotificationsForUser } from "@/lib/data/notifications";
import { getOrgsForUser } from "@/lib/data/organization";
import { getActiveTeamsForUser, getPlayerProfileFull, getPlayerStats } from "@/lib/data/player";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

export default async function AppMePage() {
	const { user } = await requireWorkspaceSession();

	const [profile, stats, orgs, teams, { notifications: allNotifications }] = await Promise.all([
		getPlayerProfileFull(user.id),
		getPlayerStats(user.id),
		getOrgsForUser(user.id),
		getActiveTeamsForUser(user.id),
		getNotificationsForUser(user.id),
	]);

	const recentNotifications = allNotifications.slice(0, 5);

	const orgDone = orgs.length > 0;
	const teamDone = teams.length > 0;
	const allDone = !!profile?.battletag && orgDone && teamDone;

	// Phase 18: scrims feed stub — requires per-team fetch; deferred to future phase
	const recentScrims: Array<{
		teamName: string;
		opponentName: string;
		result: "win" | "loss" | "draw" | null;
		date: string;
	}> = [];

	return (
		<PageContainer>
			<PageHeader title="Home" description={`Welcome back, ${user.displayName}`} />

			<StatsOverview stats={stats} />

			<div className="grid gap-3 lg:grid-cols-3">
				<div className="lg:col-span-2">
					{allDone ? (
						<ActivityFeedSection
							teams={teams}
							recentNotifications={recentNotifications}
							recentScrims={recentScrims}
						/>
					) : (
						<GettingStartedSection profile={profile} orgDone={orgDone} teamDone={teamDone} />
					)}
				</div>
				{profile && <ProfileSummaryCard profile={profile} />}
			</div>
		</PageContainer>
	);
}
