"use server";

import { redirect } from "next/navigation";
import { deleteSessionTokenCookie, getCurrentSession, invalidateSession } from "@/lib/auth/session";

export async function signOutAction() {
	const { session } = await getCurrentSession();
	if (session) {
		await invalidateSession(session.id, "manual_logout");
		await deleteSessionTokenCookie();
	}
	redirect("/");
}
