import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq, inArray, ne, or } from "drizzle-orm";

import { hashPassword } from "@/auth/password";
import { createSession, generateSessionToken, invalidateUserSessions } from "@/auth/session";
import { db } from "@/db";
import {
	organizationMemberTable,
	organizationTable,
	playerProfileTable,
	recruitmentApplicationTable,
	recruitmentListingTable,
	scrimTable,
	teamRosterTable,
	teamTable,
	userTable,
} from "@/db/schema";

const TEST_EMAIL = "playwright@test.scrimflow.local";
const TEST_USERNAME = "playwright-bot";
const TEST_DISPLAY_NAME = "Playwright Bot";
const TEST_PASSWORD = "TestPassword123!";

const E2E_HOME_ORG_SLUG = "e2e-home-org";
const E2E_HOME_TEAM_TAG = "E2ET";
const E2E_TARGET_ORG_SLUG = "e2e-target-org";
const E2E_TARGET_TEAM_TAG = "TGTT";
const E2E_TARGET_USER_EMAIL = "e2e-target@test.scrimflow.local";
const E2E_TARGET_USERNAME = "e2e-target-user";

const REPO_ROOT = join(import.meta.dir, "../../../../../");
const AUTH_JSON_PATH = join(REPO_ROOT, ".playwright/auth.json");
const FIXTURES_JSON_PATH = join(REPO_ROOT, ".playwright/fixtures.json");

async function main() {
	console.log("Seeding Playwright test user...");

	const dbUrl = process.env.DATABASE_URL ?? "";
	if (
		!dbUrl.includes("localhost") &&
		!dbUrl.includes("127.0.0.1") &&
		!dbUrl.includes("host.docker.internal")
	) {
		console.error(
			"❌ DATABASE_URL does not appear to point to a local database. Aborting to avoid seeding a non-local environment."
		);
		process.exit(1);
	}

	const passwordHash = await hashPassword(TEST_PASSWORD);

	// Free the username if held by a different account to avoid a unique constraint error
	await db
		.update(userTable)
		.set({ username: `pw-bot-displaced-${Date.now()}` })
		.where(and(eq(userTable.username, TEST_USERNAME), ne(userTable.email, TEST_EMAIL)));

	const [user] = await db
		.insert(userTable)
		.values({
			email: TEST_EMAIL,
			username: TEST_USERNAME,
			displayName: TEST_DISPLAY_NAME,
			passwordHash,
			emailVerified: true,
			isBanned: false,
			requiresReverification: false,
		})
		.onConflictDoUpdate({
			target: userTable.email,
			set: {
				username: TEST_USERNAME,
				displayName: TEST_DISPLAY_NAME,
				passwordHash,
				emailVerified: true,
				isBanned: false,
				requiresReverification: false,
			},
		})
		.returning({ id: userTable.id });

	if (!user) throw new Error("Failed to upsert test user");

	await db
		.insert(playerProfileTable)
		.values({
			userId: user.id,
			primaryRole: "support",
		})
		.onConflictDoUpdate({
			target: playerProfileTable.userId,
			set: { primaryRole: "support" },
		});

	console.log("Seeding E2E fixtures...");

	// E2E Home Org
	const [homeOrg] = await db
		.insert(organizationTable)
		.values({
			name: "E2E Home Org",
			slug: E2E_HOME_ORG_SLUG,
			ownerId: user.id,
		})
		.onConflictDoUpdate({
			target: organizationTable.slug,
			set: { name: "E2E Home Org", ownerId: user.id },
		})
		.returning({ id: organizationTable.id });
	if (!homeOrg) throw new Error("Failed to upsert E2E home org");

	// E2E Home Team (find-first pattern — partial unique index on tag+orgId)
	const existingHomeTeam = await db
		.select({ id: teamTable.id })
		.from(teamTable)
		.where(and(eq(teamTable.organizationId, homeOrg.id), eq(teamTable.tag, E2E_HOME_TEAM_TAG)))
		.limit(1);
	let homeTeamId: string;
	if (existingHomeTeam[0]) {
		homeTeamId = existingHomeTeam[0].id;
	} else {
		const [newTeam] = await db
			.insert(teamTable)
			.values({
				organizationId: homeOrg.id,
				name: "E2E Home Team",
				tag: E2E_HOME_TEAM_TAG,
				lifecycleStatus: "active",
			})
			.returning({ id: teamTable.id });
		if (!newTeam) throw new Error("Failed to create E2E home team");
		homeTeamId = newTeam.id;
	}

	// Playwright user as home org owner
	await db
		.insert(organizationMemberTable)
		.values({
			organizationId: homeOrg.id,
			userId: user.id,
			role: "owner",
			memberType: "player",
		})
		.onConflictDoUpdate({
			target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
			set: { role: "owner" },
		});

	// Playwright user as home team admin
	await db
		.insert(teamRosterTable)
		.values({
			teamId: homeTeamId,
			userId: user.id,
			permissionRole: "admin",
			status: "active",
			memberType: "player",
		})
		.onConflictDoUpdate({
			target: [teamRosterTable.teamId, teamRosterTable.userId],
			set: { permissionRole: "admin", status: "active" },
		});

	// E2E Target User (minimal row — no session, no password required)
	await db
		.update(userTable)
		.set({ username: `e2e-target-displaced-${Date.now()}` })
		.where(
			and(eq(userTable.username, E2E_TARGET_USERNAME), ne(userTable.email, E2E_TARGET_USER_EMAIL))
		);
	const [targetUser] = await db
		.insert(userTable)
		.values({
			email: E2E_TARGET_USER_EMAIL,
			username: E2E_TARGET_USERNAME,
			displayName: "E2E Target User",
			emailVerified: true,
			isBanned: false,
			requiresReverification: false,
		})
		.onConflictDoUpdate({
			target: userTable.email,
			set: {
				username: E2E_TARGET_USERNAME,
				displayName: "E2E Target User",
				emailVerified: true,
				isBanned: false,
			},
		})
		.returning({ id: userTable.id });
	if (!targetUser) throw new Error("Failed to upsert E2E target user");

	// E2E Target Org
	const [targetOrg] = await db
		.insert(organizationTable)
		.values({
			name: "E2E Target Org",
			slug: E2E_TARGET_ORG_SLUG,
			ownerId: targetUser.id,
		})
		.onConflictDoUpdate({
			target: organizationTable.slug,
			set: { name: "E2E Target Org", ownerId: targetUser.id },
		})
		.returning({ id: organizationTable.id });
	if (!targetOrg) throw new Error("Failed to upsert E2E target org");

	// E2E Target Team
	const existingTargetTeam = await db
		.select({ id: teamTable.id })
		.from(teamTable)
		.where(and(eq(teamTable.organizationId, targetOrg.id), eq(teamTable.tag, E2E_TARGET_TEAM_TAG)))
		.limit(1);
	let targetTeamId: string;
	if (existingTargetTeam[0]) {
		targetTeamId = existingTargetTeam[0].id;
	} else {
		const [newTeam] = await db
			.insert(teamTable)
			.values({
				organizationId: targetOrg.id,
				name: "E2E Target Team",
				tag: E2E_TARGET_TEAM_TAG,
				lifecycleStatus: "active",
			})
			.returning({ id: teamTable.id });
		if (!newTeam) throw new Error("Failed to create E2E target team");
		targetTeamId = newTeam.id;
	}

	// Target user as target org owner
	await db
		.insert(organizationMemberTable)
		.values({
			organizationId: targetOrg.id,
			userId: targetUser.id,
			role: "owner",
			memberType: "player",
		})
		.onConflictDoUpdate({
			target: [organizationMemberTable.organizationId, organizationMemberTable.userId],
			set: { role: "owner" },
		});

	// E2E Target Listing (find-first by teamId + type)
	const existingListing = await db
		.select({ id: recruitmentListingTable.id })
		.from(recruitmentListingTable)
		.where(
			and(eq(recruitmentListingTable.teamId, targetTeamId), eq(recruitmentListingTable.type, "lfp"))
		)
		.limit(1);
	let targetListingId: string;
	if (existingListing[0]) {
		targetListingId = existingListing[0].id;
		await db
			.update(recruitmentListingTable)
			.set({ status: "open", title: "E2E Test Listing" })
			.where(eq(recruitmentListingTable.id, targetListingId));
	} else {
		const [newListing] = await db
			.insert(recruitmentListingTable)
			.values({
				type: "lfp",
				ownerType: "team",
				teamId: targetTeamId,
				organizationId: targetOrg.id,
				userId: targetUser.id,
				status: "open",
				title: "E2E Test Listing",
				memberType: "player",
			})
			.returning({ id: recruitmentListingTable.id });
		if (!newListing) throw new Error("Failed to create E2E target listing");
		targetListingId = newListing.id;
	}

	// Cancel any active scrims between homeTeam and targetTeam so the scrim test
	// can always create a fresh request without hitting the active-pair unique constraint
	await db
		.update(scrimTable)
		.set({ status: "cancelled" })
		.where(
			and(
				inArray(scrimTable.status, ["pending", "accepted", "scheduled", "in_progress"]),
				or(
					and(eq(scrimTable.homeTeamId, homeTeamId), eq(scrimTable.awayTeamId, targetTeamId)),
					and(eq(scrimTable.homeTeamId, targetTeamId), eq(scrimTable.awayTeamId, homeTeamId))
				)
			)
		);

	// Clean up any previous applications from playwright user to the target listing
	// so that canApply is always true at the start of each test run
	await db
		.delete(recruitmentApplicationTable)
		.where(
			and(
				eq(recruitmentApplicationTable.applicantUserId, user.id),
				eq(recruitmentApplicationTable.listingId, targetListingId)
			)
		);

	mkdirSync(join(REPO_ROOT, ".playwright"), { recursive: true });
	writeFileSync(FIXTURES_JSON_PATH, JSON.stringify({ homeTeamId, targetListingId }, null, 2));
	console.log(`✅ E2E fixtures written to ${FIXTURES_JSON_PATH}`);

	await invalidateUserSessions(user.id);

	const token = generateSessionToken();
	await createSession(token, user.id, { twoFactorVerified: true });

	const storageState = {
		cookies: [
			{
				name: "session_token",
				value: token,
				domain: "localhost",
				path: "/",
				expires: -1,
				httpOnly: true,
				secure: false,
				sameSite: "Lax",
			},
		],
		origins: [],
	};

	writeFileSync(AUTH_JSON_PATH, JSON.stringify(storageState, null, 2));

	console.log(`✅ Playwright auth state written to ${AUTH_JSON_PATH}`);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
