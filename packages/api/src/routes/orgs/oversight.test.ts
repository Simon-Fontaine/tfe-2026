import { describe, expect, test } from "bun:test";
import { buildOrgTeamOversight } from "./oversight";

describe("organization team oversight summaries", () => {
	test("flags no-admin and inactive roster risks without exposing private records", () => {
		const oversight = buildOrgTeamOversight({
			isArchived: false,
			isPublic: false,
			activeRosterCount: 0,
			adminCount: 0,
			pendingInviteCount: 2,
			openListingCount: 1,
			pendingApplicationCount: 3,
			availabilityCount: 0,
			upcomingScrimCount: 0,
			recentScrimCount: 0,
			latestUpdateAt: null,
			canOpenWorkspace: false,
		});

		expect(oversight.relationshipState).toBe("active");
		expect(oversight.visibility).toBe("private");
		expect(oversight.canOpenWorkspace).toBe(false);
		expect(oversight.signals.map((signal) => signal.code)).toContain("no_active_roster");
		expect(oversight.signals.map((signal) => signal.code)).toContain("no_active_admin");
		expect(oversight.signals.map((signal) => signal.code)).toContain("pending_applications");
		expect(oversight.autonomyCopy).toContain("summary");
	});

	test("keeps archived team state explicit and prioritizes latest activity timestamps", () => {
		const oversight = buildOrgTeamOversight({
			isArchived: true,
			isPublic: true,
			activeRosterCount: 5,
			adminCount: 1,
			pendingInviteCount: 0,
			openListingCount: 0,
			pendingApplicationCount: 0,
			availabilityCount: 4,
			upcomingScrimCount: 1,
			recentScrimCount: 2,
			latestUpdateAt: "2026-05-20T10:00:00.000Z",
			latestScrimAt: "2026-05-21T10:00:00.000Z",
			canOpenWorkspace: true,
		});

		expect(oversight.relationshipState).toBe("archived");
		expect(oversight.latestActivityAt).toBe("2026-05-21T10:00:00.000Z");
		expect(oversight.signals.map((signal) => signal.code)).toContain("archived");
		expect(oversight.signals.map((signal) => signal.code)).toContain("upcoming_scrim");
	});
});
