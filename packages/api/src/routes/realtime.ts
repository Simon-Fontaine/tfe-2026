import type { AppRealtimeClientCommand } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import {
	registerRealtimeSocket,
	subscribeSocketToScrim,
	subscribeSocketToTeam,
	unregisterRealtimeSocket,
	unsubscribeSocketFromScrim,
	unsubscribeSocketFromTeam,
} from "@/realtime/scrim-hub";
import { getTeamAccessContext, isUserOnTeam } from "@/utils/team";
import { upgradeWebSocket } from "@/websocket";

const realtimeRoutes = new Hono<AuthEnv>();

async function canAccessScrim(userId: string, scrimId: string) {
	const scrim = await db.query.scrimTable.findFirst({
		where: eq(scrimTable.id, scrimId),
		columns: {
			homeTeamId: true,
			awayTeamId: true,
		},
	});
	if (!scrim) return false;
	if (await isUserOnTeam(userId, scrim.homeTeamId)) return true;
	if (scrim.awayTeamId && (await isUserOnTeam(userId, scrim.awayTeamId))) return true;
	return false;
}

async function canAccessTeam(userId: string, teamId: string) {
	const access = await getTeamAccessContext(teamId, userId);
	if (!access) return false;
	if (access.canManageTeam) return true;
	return (
		access.teamStatus === "active" ||
		access.teamStatus === "benched" ||
		access.teamStatus === "trial"
	);
}

realtimeRoutes.get(
	"/ws",
	upgradeWebSocket((c) => {
		const user = c.get("user");

		async function handleCommand(raw: string, ws: { send: (value: string) => void }) {
			const parsed = JSON.parse(raw) as AppRealtimeClientCommand;
			if (!parsed?.type) {
				ws.send(JSON.stringify({ type: "realtime:error", error: "Invalid websocket payload." }));
				return;
			}

			if (parsed.type === "ping") {
				ws.send(JSON.stringify({ type: "realtime:pong" }));
				return;
			}

			if (parsed.type === "subscribe:scrim") {
				const scrimId = parsed.scrimId;
				if (!scrimId) {
					ws.send(JSON.stringify({ type: "realtime:error", error: "scrimId is required." }));
					return;
				}

				const hasAccess = await canAccessScrim(user.id, scrimId);
				if (!hasAccess) {
					ws.send(
						JSON.stringify({
							type: "realtime:error",
							error: "You do not have access to this scrim.",
							scrimId,
						})
					);
					return;
				}

				subscribeSocketToScrim(ws as { send: (payload: string) => unknown }, scrimId);
				return;
			}

			if (parsed.type === "unsubscribe:scrim") {
				unsubscribeSocketFromScrim(ws as { send: (payload: string) => unknown }, parsed.scrimId);
				return;
			}

			if (parsed.type === "subscribe:team") {
				const teamId = parsed.teamId;
				if (!teamId) {
					ws.send(JSON.stringify({ type: "realtime:error", error: "teamId is required." }));
					return;
				}

				const hasAccess = await canAccessTeam(user.id, teamId);
				if (!hasAccess) {
					ws.send(
						JSON.stringify({
							type: "realtime:error",
							error: "You do not have access to this team.",
						})
					);
					return;
				}

				subscribeSocketToTeam(ws as { send: (payload: string) => unknown }, teamId);
				return;
			}

			if (parsed.type === "unsubscribe:team") {
				unsubscribeSocketFromTeam(ws as { send: (payload: string) => unknown }, parsed.teamId);
				return;
			}
		}

		return {
			onOpen(_event, ws) {
				registerRealtimeSocket(ws, user.id);
			},
			onMessage(event, ws) {
				void handleCommand(event.data.toString(), ws).catch(() => {
					ws.send(JSON.stringify({ type: "realtime:error", error: "Unable to process command." }));
				});
			},
			onClose(_event, ws) {
				unregisterRealtimeSocket(ws);
			},
			onError(_event, ws) {
				unregisterRealtimeSocket(ws);
			},
		};
	})
);

export { realtimeRoutes };
