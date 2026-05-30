import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { and, eq, ne } from "drizzle-orm";

import { hashPassword } from "@/auth/password";
import { createSession, generateSessionToken, invalidateUserSessions } from "@/auth/session";
import { db } from "@/db";
import { playerProfileTable, userTable } from "@/db/schema";

const TEST_EMAIL = "playwright@test.scrimflow.local";
const TEST_USERNAME = "playwright-bot";
const TEST_DISPLAY_NAME = "Playwright Bot";
const TEST_PASSWORD = "TestPassword123!";

const REPO_ROOT = join(import.meta.dir, "../../../../../");
const AUTH_JSON_PATH = join(REPO_ROOT, ".playwright/auth.json");

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

	mkdirSync(join(REPO_ROOT, ".playwright"), { recursive: true });
	writeFileSync(AUTH_JSON_PATH, JSON.stringify(storageState, null, 2));

	console.log(`✅ Playwright auth state written to ${AUTH_JSON_PATH}`);
	process.exit(0);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
