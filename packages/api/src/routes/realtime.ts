import type { AppRealtimeClientCommand } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import {
	disconnectRealtimeSession,
	registerRealtimeSocket,
	subscribeSocketToScrim,
	subscribeSocketToTeam,
	unregisterRealtimeSocket,
	unsubscribeSocketFromScrim,
	unsubscribeSocketFromTeam,
} from "@/realtime/scrim-hub";
import { getTeamAccessContext, isUserOnTeam } from "@/utils/team";
import {
	createWsSessionGuard,
	parseWsCommand,
	type WsErrorCode,
	type WsRouteSocket,
} from "@/utils/ws-session";
import { upgradeWebSocket } from "@/websocket";

const realtimeRoutes = new Hono<AuthEnv>();

function sendRealtimeError(
	ws: WsRouteSocket,
	params: {
		error: string;
		code: WsErrorCode;
		retryable: boolean;
		scrimId?: string;
		teamId?: string;
	}
) {
	ws.send(JSON.stringify({ type: "realtime:error", ...params }));
}

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
		const session = c.get("session");

		const ensureActiveSession = createWsSessionGuard(session.id, disconnectRealtimeSession);

		async function handleCommand(raw: string, ws: WsRouteSocket) {
			const parsed = parseWsCommand<AppRealtimeClientCommand>(raw, ws, sendRealtimeError);
			if (!parsed) return;

			if (parsed.type === "ping") {
				if (!(await ensureActiveSession())) return;
				ws.send(JSON.stringify({ type: "realtime:pong" }));
				return;
			}

			if (parsed.type === "subscribe:scrim") {
				if (!(await ensureActiveSession())) return;

				const scrimId = parsed.scrimId;
				if (!scrimId) {
					sendRealtimeError(ws, {
						error: "scrimId is required.",
						code: "missing_field",
						retryable: false,
					});
					return;
				}

				const hasAccess = await canAccessScrim(user.id, scrimId);
				if (!hasAccess) {
					sendRealtimeError(ws, {
						error: "You do not have access to this scrim.",
						code: "access_denied",
						retryable: false,
						scrimId,
					});
					return;
				}

				subscribeSocketToScrim(ws, scrimId);
				return;
			}

			if (parsed.type === "unsubscribe:scrim") {
				unsubscribeSocketFromScrim(ws, parsed.scrimId);
				return;
			}

			if (parsed.type === "subscribe:team") {
				if (!(await ensureActiveSession())) return;

				const teamId = parsed.teamId;
				if (!teamId) {
					sendRealtimeError(ws, {
						error: "teamId is required.",
						code: "missing_field",
						retryable: false,
					});
					return;
				}

				const hasAccess = await canAccessTeam(user.id, teamId);
				if (!hasAccess) {
					sendRealtimeError(ws, {
						error: "You do not have access to this team.",
						code: "access_denied",
						retryable: false,
						teamId,
					});
					return;
				}

				subscribeSocketToTeam(ws, teamId);
				return;
			}

			if (parsed.type === "unsubscribe:team") {
				unsubscribeSocketFromTeam(ws, parsed.teamId);
				return;
			}
		}

		return {
			onOpen(_event, ws) {
				registerRealtimeSocket(ws, user.id, session.id);
			},
			onMessage(event, ws) {
				void handleCommand(event.data.toString(), ws).catch(() => {
					sendRealtimeError(ws, {
						error: "Unable to process command.",
						code: "internal_error",
						retryable: true,
					});
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
