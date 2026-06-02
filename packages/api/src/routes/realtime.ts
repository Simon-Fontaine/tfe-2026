import type { RealtimeClientCommand } from "@scrimflow/shared";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "@/db";
import { scrimTable } from "@/db/schema";
import type { AuthEnv } from "@/middleware/auth";
import {
	publishConversationEvent,
	refreshSocketPresence,
	registerChatSocket,
	subscribeSocketToConversation,
	unregisterChatSocket,
	unsubscribeSocketFromConversation,
} from "@/realtime/chat-hub";
import { broadcastUserPresence } from "@/realtime/presence-broadcast";
import {
	disconnectRealtimeSession,
	registerRealtimeSocket,
	subscribeSocketToOrg,
	subscribeSocketToScrim,
	subscribeSocketToTeam,
	unregisterRealtimeSocket,
	unsubscribeSocketFromOrg,
	unsubscribeSocketFromScrim,
	unsubscribeSocketFromTeam,
} from "@/realtime/scrim-hub";
import { hasConversationAccess } from "@/utils/chat";
import { getOrgPermissions } from "@/utils/org";
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
		organizationId?: string;
		conversationId?: string;
	}
) {
	ws.send(JSON.stringify({ type: "realtime:error", ...params }));
}

function sendChatError(
	ws: WsRouteSocket,
	params: {
		error: string;
		code: WsErrorCode;
		retryable: boolean;
		conversationId?: string;
	}
) {
	ws.send(JSON.stringify({ type: "chat:error", ...params }));
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

async function canAccessOrg(userId: string, organizationId: string) {
	const permissions = await getOrgPermissions(organizationId, userId);
	return !!permissions.role;
}

realtimeRoutes.get(
	"/ws",
	upgradeWebSocket((c) => {
		const user = c.get("user");
		const session = c.get("session");

		const ensureActiveSession = createWsSessionGuard(session.id, disconnectRealtimeSession);

		// Hono's Bun adapter creates a NEW `WSContext` wrapper on every callback
		// (open/message/close), even though the underlying socket is the same. The
		// realtime/chat hubs key their subscription Maps by socket identity, so we
		// must pin a single stable reference for this connection (captured in
		// `onOpen`) and use it everywhere — otherwise `socketMeta.get(ws)` misses in
		// `onMessage` and every subscribe/typing/presence command silently no-ops.
		let connectionSocket: WsRouteSocket | null = null;

		async function handleCommand(raw: string, ws: WsRouteSocket) {
			const parsed = parseWsCommand<RealtimeClientCommand>(raw, ws, sendRealtimeError);
			if (!parsed) return;

			if (parsed.type === "ping") {
				if (!(await ensureActiveSession())) return;
				ws.send(JSON.stringify({ type: "realtime:pong" }));
				return;
			}

			if (parsed.type === "presence:heartbeat") {
				if (!(await ensureActiveSession())) return;
				refreshSocketPresence(ws);
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

			if (parsed.type === "subscribe:org") {
				if (!(await ensureActiveSession())) return;

				const organizationId = parsed.organizationId;
				if (!organizationId) {
					sendRealtimeError(ws, {
						error: "organizationId is required.",
						code: "missing_field",
						retryable: false,
					});
					return;
				}

				const hasAccess = await canAccessOrg(user.id, organizationId);
				if (!hasAccess) {
					sendRealtimeError(ws, {
						error: "You do not have access to this organization.",
						code: "access_denied",
						retryable: false,
						organizationId,
					});
					return;
				}

				subscribeSocketToOrg(ws, organizationId);
				return;
			}

			if (parsed.type === "unsubscribe:org") {
				unsubscribeSocketFromOrg(ws, parsed.organizationId);
				return;
			}

			if (
				parsed.type === "subscribe" ||
				parsed.type === "unsubscribe" ||
				parsed.type === "typing:start" ||
				parsed.type === "typing:stop"
			) {
				if (!parsed.conversationId) {
					sendChatError(ws, {
						error: "conversationId is required.",
						code: "missing_field",
						retryable: false,
					});
					return;
				}

				if (parsed.type === "unsubscribe") {
					unsubscribeSocketFromConversation(ws, parsed.conversationId);
					return;
				}

				if (parsed.type === "subscribe" && !(await ensureActiveSession())) return;

				const hasAccess = await hasConversationAccess(parsed.conversationId, user.id);
				if (!hasAccess) {
					sendChatError(ws, {
						error: "You do not have access to this conversation.",
						code: "access_denied",
						retryable: false,
						conversationId: parsed.conversationId,
					});
					return;
				}

				if (parsed.type === "subscribe") {
					subscribeSocketToConversation(ws, parsed.conversationId);
					return;
				}

				publishConversationEvent({
					conversationId: parsed.conversationId,
					event: parsed.type,
					excludeUserId: user.id,
					payload: { userId: user.id },
				});
			}
		}

		return {
			onOpen(_event, ws) {
				// Pin this connection's stable socket reference (see note above).
				connectionSocket = ws;
				registerRealtimeSocket(ws, user.id, session.id);
				const { firstConnection } = registerChatSocket(ws, user.id, session.id);
				if (firstConnection) void broadcastUserPresence(user.id, "online");
			},
			onMessage(event, ws) {
				const socket = connectionSocket ?? ws;
				void handleCommand(event.data.toString(), socket).catch(() => {
					sendRealtimeError(socket, {
						error: "Unable to process command.",
						code: "internal_error",
						retryable: true,
					});
				});
			},
			onClose(_event, ws) {
				const socket = connectionSocket ?? ws;
				unregisterRealtimeSocket(socket);
				const { lastConnection } = unregisterChatSocket(socket);
				if (lastConnection) void broadcastUserPresence(user.id, "offline");
				connectionSocket = null;
			},
			onError(_event, ws) {
				const socket = connectionSocket ?? ws;
				unregisterRealtimeSocket(socket);
				const { lastConnection } = unregisterChatSocket(socket);
				if (lastConnection) void broadcastUserPresence(user.id, "offline");
				connectionSocket = null;
			},
		};
	})
);

export { realtimeRoutes };
