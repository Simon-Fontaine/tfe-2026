import type { Session, SessionUser, SessionValidationResult } from "@scrimflow/shared";
import { apiRoutes } from "@scrimflow/shared";
import { cookies } from "next/headers";
import { cache } from "react";
import { apiGet } from "@/lib/api-client";

export type { Session, SessionUser, SessionValidationResult } from "@scrimflow/shared";

/** Request-memoized current session via API. */
export const getCurrentSession = cache(async (): Promise<SessionValidationResult> => {
	const res = await apiGet<{ session: Session | null; user: SessionUser | null }>(
		apiRoutes.auth.session
	);
	if ("data" in res && res.data.session && res.data.user) {
		return { session: res.data.session, user: res.data.user };
	}
	return { session: null, user: null };
});

export async function deleteSessionTokenCookie(): Promise<void> {
	const cookieStore = await cookies();
	cookieStore.set("session_token", "", {
		httpOnly: true,
		path: "/",
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: 0,
	});
}
