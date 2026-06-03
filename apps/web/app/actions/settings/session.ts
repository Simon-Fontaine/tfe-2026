"use server";

import { apiRoutes } from "@scrimflow/shared";
import { apiDelete, apiGet } from "@/lib/api-client";
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
	const res = await apiGet<SessionInfo[]>(apiRoutes.settings.sessions.root);
	if ("data" in res) return res.data;
	return [];
}

export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.sessions.byId(sessionId));
	if ("error" in res) return { error: res.error };
	return { success: true };
}

export async function revokeAllOtherSessionsAction(): Promise<ActionResult> {
	const res = await apiDelete(apiRoutes.settings.sessions.root);
	if ("error" in res) return { error: res.error };
	return { success: true };
}
