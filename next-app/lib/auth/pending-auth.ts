import { cookies } from "next/headers";

/**
 * Carries user ID through multi-step flows without creating full session.
 */

const COOKIE_NAME = "pending_auth_user_id";
const MAX_AGE_SECONDS = 60 * 15;

export async function setPendingAuthCookie(userId: string): Promise<void> {
	const jar = await cookies();
	jar.set(COOKIE_NAME, userId, {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: MAX_AGE_SECONDS,
	});
}

export async function getPendingAuthUserId(): Promise<string | null> {
	const jar = await cookies();
	return jar.get(COOKIE_NAME)?.value ?? null;
}

export async function deletePendingAuthCookie(): Promise<void> {
	const jar = await cookies();
	jar.delete(COOKIE_NAME);
}
