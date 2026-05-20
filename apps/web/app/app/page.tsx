import { canApplyToInvite, type UserTeam } from "@scrimflow/shared";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AttentionQueue, type AttentionQueueItem } from "@/components/workspace/attention-queue";
import { GettingStartedSection } from "@/components/workspace/getting-started-section";
import { PageContainer } from "@/components/workspace/page-container";
import { PageHeader } from "@/components/workspace/page-header";
import { PageSection } from "@/components/workspace/page-section";
import { ProfileSummaryCard } from "@/components/workspace/profile-summary-card";
import { StatsOverview } from "@/components/workspace/stats-overview";
import type { NotificationSummary } from "@/lib/data/notifications";
import type { OrgInviteSummary, UserOrg } from "@/lib/data/organization";
import {
	getPersonalHomeData,
	type HomeRecruitingAction,
	type HomeScrimSummary,
} from "@/lib/data/personal-home";
import type { RecruitmentApplicationSummary } from "@/lib/data/recruit";
import type { TeamInviteSummary } from "@/lib/data/team";
import { appRoutes } from "@/lib/routes";
import { requireWorkspaceSession } from "@/lib/workspace-shell";

type SectionResult<T> = { status: "success"; data: T } | { status: "error"; error: string };

function successOr<T>(result: SectionResult<T>, fallback: T): T {
	return result.status === "success" ? result.data : fallback;
}

function SectionError({ title, error }: { title: string; error: string }) {
	return (
		<Alert variant="destructive">
			<AlertTitle>{title}</AlertTitle>
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	);
}

function teamInviteItems(invites: TeamInviteSummary[]): AttentionQueueItem[] {
	return invites
		.filter((invite) => canApplyToInvite(invite.status, invite.expiresAt))
		.map((invite) => ({
			id: `team-invite-${invite.id}`,
			title: `[${invite.teamTag}] ${invite.teamName} invited you`,
			objectType: "team invite",
			contextLabel: "Personal",
			statusText: "Pending response",
			timestamp: invite.expiresAt,
			priority: 10,
			sortDirection: "asc",
			actionLabel: "Open inbox",
			href: appRoutes.inbox,
		}));
}

function orgInviteItems(invites: OrgInviteSummary[]): AttentionQueueItem[] {
	return invites
		.filter((invite) => canApplyToInvite(invite.status, invite.expiresAt))
		.map((invite) => ({
			id: `org-invite-${invite.id}`,
			title: `${invite.orgName} invited you`,
			objectType: "organization invite",
			contextLabel: "Personal",
			statusText: "Pending response",
			timestamp: invite.expiresAt,
			priority: 11,
			sortDirection: "asc",
			actionLabel: "Open inbox",
			href: appRoutes.inbox,
		}));
}

function recruitingActionItems(actions: HomeRecruitingAction[]): AttentionQueueItem[] {
	return actions.map(({ listing, application }) => ({
		id: `recruiting-action-${application.id}`,
		title: `${application.applicantDisplayName} applied to ${listing.title}`,
		objectType: "recruiting application",
		contextLabel:
			listing.teamName && listing.teamTag
				? `[${listing.teamTag}] ${listing.teamName}`
				: (listing.organizationName ?? "Personal recruiting"),
		statusText: "Decision needed",
		timestamp: application.createdAt,
		priority: 30,
		actionLabel: "Review",
		href: appRoutes.recruiting.byId(listing.id),
	}));
}

function myApplicationItems(applications: RecruitmentApplicationSummary[]): AttentionQueueItem[] {
	return applications
		.filter((application) => application.status === "accepted" || application.status === "rejected")
		.map((application) => ({
			id: `my-application-${application.id}`,
			title: `${application.listingTitle} application ${application.status}`,
			objectType: "application update",
			contextLabel:
				application.senderTeamName && application.senderTeamTag
					? `[${application.senderTeamTag}] ${application.senderTeamName}`
					: (application.senderOrganizationName ?? "Recruiting"),
			statusText: application.status === "accepted" ? "Accepted" : "Declined",
			timestamp: application.updatedAt,
			priority: 50,
			actionLabel: application.conversationId ? "Open conversation" : "Open listing",
			href: application.conversationId
				? appRoutes.recruiting.conversations
				: appRoutes.recruiting.byId(application.listingId),
		}));
}

function scrimItems(scrims: HomeScrimSummary[]): AttentionQueueItem[] {
	const actionableStatuses = new Set([
		"pending",
		"accepted",
		"scheduled",
		"in_progress",
		"awaiting_confirmation",
		"disputed",
	]);
	return scrims
		.filter((scrim) => actionableStatuses.has(scrim.status))
		.map((scrim) => ({
			id: `scrim-${scrim.id}`,
			title: `${scrim.contextTeamName} vs ${scrim.awayTeam?.name ?? "TBD"}`,
			objectType: "scrim",
			contextLabel: `[${scrim.contextTeamTag}] ${scrim.contextTeamName}`,
			statusText: scrim.status.replaceAll("_", " "),
			timestamp: scrim.scheduledAt ?? scrim.updatedAt,
			priority:
				scrim.status === "disputed"
					? 15
					: scrim.status === "in_progress"
						? 16
						: scrim.status === "awaiting_confirmation"
							? 20
							: 25,
			sortDirection: "asc",
			actionLabel: "Open scrim",
			href: appRoutes.teams.scrimById(scrim.contextTeamId, scrim.id),
		}));
}

function safeWorkspaceHref(href: string | null) {
	if (!href) return appRoutes.inbox;
	return href === appRoutes.root || href.startsWith(`${appRoutes.root}/`) ? href : appRoutes.inbox;
}

function notificationItems(notifications: NotificationSummary[]): AttentionQueueItem[] {
	return notifications
		.filter((notification) => !notification.isRead)
		.slice(0, 5)
		.map((notification) => ({
			id: `notification-${notification.id}`,
			title: notification.title,
			objectType: "notification",
			contextLabel: "Inbox",
			statusText: "Unread",
			timestamp: notification.createdAt,
			priority: 60,
			actionLabel: "Open",
			href: safeWorkspaceHref(notification.destinationHref),
		}));
}

function buildAttentionItems(data: Awaited<ReturnType<typeof getPersonalHomeData>>) {
	return [
		...teamInviteItems(successOr(data.teamInvites, [])),
		...orgInviteItems(successOr(data.orgInvites, [])),
		...scrimItems(successOr(data.scrims, [])),
		...recruitingActionItems(successOr(data.recruitingActions, [])),
		...myApplicationItems(successOr(data.myApplications, [])),
		...notificationItems(successOr(data.notifications, [])),
	];
}

function WorkspaceContexts({ orgs, teams }: { orgs: UserOrg[]; teams: UserTeam[] }) {
	const orgTeamIds = new Set(orgs.flatMap((org) => org.teams.map((team) => team.id)));
	const standaloneTeams = teams.filter((team) => !orgTeamIds.has(team.id));

	if (orgs.length === 0 && standaloneTeams.length === 0) {
		return (
			<Card>
				<CardContent className="space-y-3 p-4">
					<p className="text-sm font-semibold">No teams or organizations yet</p>
					<p className="text-sm text-muted-foreground">
						Create a team, join an organization invite, or browse recruiting to connect this account
						to active workflows.
					</p>
					<div className="flex flex-wrap gap-2">
						<Button asChild size="sm">
							<Link href={appRoutes.orgs.root}>Open organizations</Link>
						</Button>
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.recruiting.root}>Browse recruiting</Link>
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="grid gap-3 md:grid-cols-2">
			{standaloneTeams.map((team) => (
				<Card key={team.id}>
					<CardHeader className="pb-2">
						<div className="flex min-w-0 items-center justify-between gap-3">
							<CardTitle className="truncate text-sm">
								[{team.tag}] {team.name}
							</CardTitle>
							<Badge variant="secondary" className="shrink-0 text-[10px]">
								Team
							</Badge>
						</div>
					</CardHeader>
					<CardContent>
						<Button asChild size="sm" variant="outline">
							<Link href={appRoutes.teams.byId(team.id)}>Open team</Link>
						</Button>
					</CardContent>
				</Card>
			))}
			{orgs.map((org) => (
				<Card key={org.id}>
					<CardHeader className="pb-2">
						<div className="flex min-w-0 items-center justify-between gap-3">
							<CardTitle className="truncate text-sm">{org.name}</CardTitle>
							<Badge variant="secondary" className="shrink-0 text-[10px]">
								{org.role}
							</Badge>
						</div>
					</CardHeader>
					<CardContent className="space-y-3">
						<p className="text-xs text-muted-foreground">
							{org.teamCount} teams - {org.openListingCount} open listings
						</p>
						<div className="flex flex-wrap gap-2">
							<Button asChild size="sm" variant="outline">
								<Link href={appRoutes.orgs.byId(org.id)}>Open org</Link>
							</Button>
							{org.teams.slice(0, 3).map((team) => (
								<Button key={team.id} asChild size="sm" variant="ghost">
									<Link href={appRoutes.teams.byId(team.id)}>[{team.tag}]</Link>
								</Button>
							))}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	);
}

export default async function AppHomePage() {
	const { user } = await requireWorkspaceSession();
	const data = await getPersonalHomeData(user.id);
	const profile = successOr(data.profile, null);
	const stats = successOr(data.stats, { topTeamRating: null, scrimsPlayed: 0, wins: 0 });
	const orgs = successOr(data.orgs, []);
	const teams = successOr(data.teams, []);
	const attentionItems = buildAttentionItems(data);
	const orgDone = orgs.length > 0;
	const teamDone = teams.length > 0;

	return (
		<PageContainer maxWidth="full">
			<PageHeader title="Home" description={`Personal command center for ${user.displayName}`} />

			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-6">
					{data.profile.status === "error" ? (
						<SectionError title="Profile could not be loaded" error={data.profile.error} />
					) : null}
					{data.stats.status === "error" ? (
						<SectionError title="Stats could not be loaded" error={data.stats.error} />
					) : (
						<StatsOverview stats={stats} />
					)}

					<PageSection
						title="Attention queue"
						description="Actionable invites, scrims, recruiting decisions, and unread workflow updates."
						actions={
							<Button asChild size="sm" variant="outline">
								<Link href={appRoutes.inbox}>Open inbox</Link>
							</Button>
						}
					>
						{[
							data.teamInvites,
							data.orgInvites,
							data.scrims,
							data.recruitingActions,
							data.myApplications,
							data.notifications,
						].some((section) => section.status === "error") ? (
							<SectionError
								title="Some attention sources could not be loaded"
								error="Available sections are still shown. Refresh the page to retry the failed sources."
							/>
						) : null}
						<AttentionQueue items={attentionItems} />
					</PageSection>

					<PageSection
						title="Workspaces"
						description="Current personal, team, and organization contexts."
					>
						{data.orgs.status === "error" ? (
							<SectionError title="Organizations could not be loaded" error={data.orgs.error} />
						) : null}
						{data.teams.status === "error" ? (
							<SectionError title="Teams could not be loaded" error={data.teams.error} />
						) : null}
						{data.orgs.status === "success" || data.teams.status === "success" ? (
							<WorkspaceContexts orgs={orgs} teams={teams} />
						) : null}
					</PageSection>
				</div>

				<aside className="space-y-4">
					<GettingStartedSection profile={profile} orgDone={orgDone} teamDone={teamDone} />
					{profile ? <ProfileSummaryCard profile={profile} /> : null}
					<Card>
						<CardHeader className="pb-2">
							<CardTitle className="text-sm">Next destinations</CardTitle>
						</CardHeader>
						<CardContent className="grid gap-2">
							<Button asChild size="sm" variant="outline" className="justify-start">
								<Link href={appRoutes.calendar}>Personal schedule</Link>
							</Button>
							<Button asChild size="sm" variant="outline" className="justify-start">
								<Link href={appRoutes.profile}>Profile</Link>
							</Button>
							<Button asChild size="sm" variant="outline" className="justify-start">
								<Link href={appRoutes.settings.account}>Settings</Link>
							</Button>
						</CardContent>
					</Card>
				</aside>
			</div>
		</PageContainer>
	);
}
