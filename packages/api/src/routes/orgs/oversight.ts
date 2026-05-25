import type {
	IsoDateString,
	OrgTeamOperationalHealth,
	OrgTeamOversightSignal,
} from "@scrimflow/shared";

export type OrgTeamOversightInput = {
	isArchived: boolean;
	isPublic: boolean;
	activeRosterCount: number;
	adminCount: number;
	pendingInviteCount: number;
	openListingCount: number;
	pendingApplicationCount: number;
	availabilityCount: number;
	upcomingScrimCount: number;
	recentScrimCount: number;
	latestUpdateAt: IsoDateString | null;
	latestScrimAt?: IsoDateString | null;
	canOpenWorkspace: boolean;
	summaryState?: OrgTeamOperationalHealth["summaryState"];
};

function latestIsoDate(values: Array<IsoDateString | null | undefined>): IsoDateString | null {
	const latest = values
		.flatMap((value) => {
			if (!value) return [];
			const time = new Date(value).getTime();
			return Number.isNaN(time) ? [] : [{ value, time }];
		})
		.sort((a, b) => b.time - a.time)[0];

	return latest?.value ?? null;
}

function signal(
	code: OrgTeamOversightSignal["code"],
	label: string,
	severity: OrgTeamOversightSignal["severity"],
	count: number | null = null,
	at: IsoDateString | null = null
): OrgTeamOversightSignal {
	return { code, label, severity, count, at };
}

export function buildOrgTeamOversight(input: OrgTeamOversightInput): OrgTeamOperationalHealth {
	const latestScrimAt = input.latestScrimAt ?? null;
	const signals: OrgTeamOversightSignal[] = [];
	const summaryState = input.summaryState ?? "loaded";

	if (summaryState !== "loaded") {
		return {
			summaryState,
			relationshipState: input.isArchived ? "archived" : "active",
			visibility: input.isPublic ? "public" : "private",
			canOpenWorkspace: input.canOpenWorkspace,
			autonomyCopy:
				summaryState === "partial-failed"
					? "Some org oversight signals are temporarily unavailable. Team-owner actions remain gated in the team workspace."
					: "Org oversight summary unavailable. Team-private workspace records require team access.",
			activeRosterCount: input.activeRosterCount,
			adminCount: input.adminCount,
			pendingInviteCount: 0,
			openListingCount: 0,
			pendingApplicationCount: 0,
			availabilityCount: 0,
			upcomingScrimCount: 0,
			recentScrimCount: 0,
			latestUpdateAt: null,
			latestScrimAt: null,
			latestActivityAt: null,
			signals,
		};
	}

	if (input.isArchived) signals.push(signal("archived", "Archived relationship", "info"));
	if (!input.isPublic) signals.push(signal("private_team", "Private team", "info"));
	if (input.activeRosterCount === 0) {
		signals.push(signal("no_active_roster", "No active roster", "critical"));
	}
	if (input.adminCount === 0) {
		signals.push(signal("no_active_admin", "No active team admin", "critical"));
	}
	if (input.pendingInviteCount > 0) {
		signals.push(
			signal("pending_invites", "Pending team invites", "warning", input.pendingInviteCount)
		);
	}
	if (input.openListingCount > 0) {
		signals.push(signal("recruiting", "Recruiting listings open", "info", input.openListingCount));
	}
	if (input.pendingApplicationCount > 0) {
		signals.push(
			signal(
				"pending_applications",
				"Recruiting applications pending",
				"warning",
				input.pendingApplicationCount
			)
		);
	}
	if (input.availabilityCount === 0 && !input.isArchived) {
		signals.push(signal("no_schedule", "No schedule availability", "warning"));
	}
	if (input.upcomingScrimCount > 0) {
		signals.push(
			signal("upcoming_scrim", "Upcoming scrims", "info", input.upcomingScrimCount, latestScrimAt)
		);
	}
	if (input.recentScrimCount > 0) {
		signals.push(
			signal("recent_scrim", "Recent scrim activity", "info", input.recentScrimCount, latestScrimAt)
		);
	}
	if (input.latestUpdateAt) {
		signals.push(signal("recent_update", "Recent team update", "info", null, input.latestUpdateAt));
	}

	return {
		summaryState,
		relationshipState: input.isArchived ? "archived" : "active",
		visibility: input.isPublic ? "public" : "private",
		canOpenWorkspace: input.canOpenWorkspace,
		autonomyCopy: input.canOpenWorkspace
			? "Org admin access. Team-owner actions remain explicit in the team workspace."
			: "Org oversight summary only. Team-private workspace records require team access.",
		activeRosterCount: input.activeRosterCount,
		adminCount: input.adminCount,
		pendingInviteCount: input.pendingInviteCount,
		openListingCount: input.openListingCount,
		pendingApplicationCount: input.pendingApplicationCount,
		availabilityCount: input.availabilityCount,
		upcomingScrimCount: input.upcomingScrimCount,
		recentScrimCount: input.recentScrimCount,
		latestUpdateAt: input.latestUpdateAt,
		latestScrimAt,
		latestActivityAt: latestIsoDate([input.latestUpdateAt, latestScrimAt]),
		signals,
	};
}
