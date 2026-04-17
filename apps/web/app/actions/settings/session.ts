"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { apiDelete, apiGet, apiPost } from "@/lib/api-client";
import type { ActionResult } from "./password";

export interface SessionInfo {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	geoCountry: string | null;
	geoCity: string | null;
	lastActiveAt: string;
	createdAt: string;
	isCurrent: boolean;
}

export async function getActiveSessionsAction(): Promise<SessionInfo[]> {
	const res = await apiGet<SessionInfo[]>("/api/settings/sessions");
	if ("data" in res) return res.data;
	return [];
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
	const res = await apiDelete(`/api/settings/sessions/${sessionId}`);
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function revokeAllOtherSessionsAction(): Promise<ActionResult> {
	const res = await apiDelete("/api/settings/sessions");
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function logoutAction(): Promise<void> {
	await apiPost("/api/settings/sessions/logout");
	const cookieStore = await cookies();
	cookieStore.delete("session_token");
	redirect("/");
}
