import type {
	NotificationSummary,
	OrgInviteSummary,
	RecruitmentApplicationSummary,
	RecruitmentListingSummary,
	ScrimSummary,
	TeamInviteSummary,
	UserOrg,
	UserTeam,
} from "@scrimflow/shared";
import { cache } from "react";
import { getNotificationsForUser } from "@/lib/data/notifications";
import { getOrgsForUser, getPendingOrgInvitesForUser } from "@/lib/data/organization";
import { getActiveTeamsForUser, getPlayerProfileFull, getPlayerStats } from "@/lib/data/player";
import {
	getMyRecruitmentApplications,
	getMyRecruitmentListings,
	getRecruitmentApplicationsForListing,
} from "@/lib/data/recruit";
import { getTeamScrims } from "@/lib/data/scrims";
import { getPendingTeamInvitesForUser } from "@/lib/data/team";

type SectionResult<T> = { status: "success"; data: T } | { status: "error"; error: string };

export type HomeRecruitingAction = {
	listing: RecruitmentListingSummary;
	application: RecruitmentApplicationSummary;
};

export type HomeScrimSummary = ScrimSummary & {
	contextTeamId: string;
	contextTeamName: string;
	contextTeamTag: string;
};

export type PersonalHomeData = {
	profile: SectionResult<Awaited<ReturnType<typeof getPlayerProfileFull>>>;
	stats: SectionResult<Awaited<ReturnType<typeof getPlayerStats>>>;
	orgs: SectionResult<UserOrg[]>;
	teams: SectionResult<UserTeam[]>;
	teamInvites: SectionResult<TeamInviteSummary[]>;
	orgInvites: SectionResult<OrgInviteSummary[]>;
	notifications: SectionResult<NotificationSummary[]>;
	myApplications: SectionResult<RecruitmentApplicationSummary[]>;
	recruitingActions: SectionResult<HomeRecruitingAction[]>;
	scrims: SectionResult<HomeScrimSummary[]>;
};

async function capture<T>(load: () => Promise<T>): Promise<SectionResult<T>> {
	try {
		return { status: "success", data: await load() };
	} catch (error) {
		return {
			status: "error",
			error: error instanceof Error ? error.message : "This section could not be loaded.",
		};
	}
}

function successOr<T>(result: SectionResult<T>, fallback: T): T {
	return result.status === "success" ? result.data : fallback;
}

export const getPersonalHomeData = cache(async (userId: string): Promise<PersonalHomeData> => {
	const [profile, stats, orgs, teams, teamInvites, orgInvites, notifications, myApplications] =
		await Promise.all([
			capture(() => getPlayerProfileFull(userId)),
			capture(() => getPlayerStats(userId)),
			capture(() => getOrgsForUser(userId)),
			capture(() => getActiveTeamsForUser(userId)),
			capture(() => getPendingTeamInvitesForUser(userId)),
			capture(() => getPendingOrgInvitesForUser(userId)),
			capture(async () => {
				const response = await getNotificationsForUser(userId);
				return response.notifications;
			}),
			capture(() => getMyRecruitmentApplications()),
		]);

	const teamRows = successOr(teams, []);
	const scrims = await capture(async () => {
		const teamScrims = await Promise.all(
			teamRows.map(async (team) => {
				const response = await getTeamScrims(team.id);
				return response.scrims.map((scrim) => ({
					...scrim,
					contextTeamId: team.id,
					contextTeamName: team.name,
					contextTeamTag: team.tag,
				}));
			})
		);

		return teamScrims.flat().sort((a, b) => {
			const aTime = a.scheduledAt ?? a.updatedAt ?? a.createdAt;
			const bTime = b.scheduledAt ?? b.updatedAt ?? b.createdAt;
			return new Date(aTime).getTime() - new Date(bTime).getTime();
		});
	});

	const recruitingActions = await capture(async () => {
		const listings = (await getMyRecruitmentListings()).filter(
			(listing) => listing.status === "open" && listing.canManage
		);
		const applications = await Promise.all(
			listings.map(async (listing) => ({
				listing,
				applications: await getRecruitmentApplicationsForListing(listing.id),
			}))
		);

		return applications.flatMap(({ listing, applications }) =>
			applications
				.filter((application) => application.status === "pending")
				.map((application) => ({ listing, application }))
		);
	});

	return {
		profile,
		stats,
		orgs,
		teams,
		teamInvites,
		orgInvites,
		notifications,
		myApplications,
		recruitingActions,
		scrims,
	};
});
