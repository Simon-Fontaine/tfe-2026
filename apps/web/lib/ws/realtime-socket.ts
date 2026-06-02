import type { RealtimeClientCommand, RealtimeEvent } from "@scrimflow/shared";
import { apiRoutes } from "@/lib/routes";
import { useChatStore } from "@/stores/chat";

type RealtimeListener = (event: RealtimeEvent) => void;

const BASE_RECONNECT_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RECONNECT_MS = 30_000;

/**
 * Single shared websocket for the whole browser session, carrying both app-domain
 * and chat-domain traffic. Chat events apply to the chat store directly; every event
 * is also broadcast to listeners so domain bridges (inbox, scrims, …) can react.
 */
class RealtimeSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private intentionalClose = false;
	private scrimSubscriptions = new Map<string, number>();
	private teamSubscriptions = new Map<string, number>();
	private orgSubscriptions = new Map<string, number>();
	private conversationSubscriptions = new Map<string, number>();
	private listeners = new Set<RealtimeListener>();
	private connected = false;
	private connectionListeners = new Set<(connected: boolean) => void>();

	connect(): void {
		if (typeof window === "undefined") return;
		if (
			this.ws &&
			(this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		this.intentionalClose = false;
		const protocol = window.location.protocol === "https:" ? "wss" : "ws";
		const url = `${protocol}://${window.location.host}${apiRoutes.realtime.ws}`;

		try {
			this.ws = new WebSocket(url);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			for (const scrimId of this.scrimSubscriptions.keys()) {
				this.sendCommand({ type: "subscribe:scrim", scrimId });
			}
			for (const teamId of this.teamSubscriptions.keys()) {
				this.sendCommand({ type: "subscribe:team", teamId });
			}
			for (const organizationId of this.orgSubscriptions.keys()) {
				this.sendCommand({ type: "subscribe:org", organizationId });
			}
			for (const conversationId of this.conversationSubscriptions.keys()) {
				this.sendCommand({ type: "subscribe", conversationId });
			}
			this.connected = true;
			for (const fn of this.connectionListeners) fn(true);
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(String(event.data)) as RealtimeEvent;
				this.handleEvent(data);
			} catch {
				// Ignore malformed frames.
			}
		};

		this.ws.onclose = () => {
			this.stopHeartbeat();
			this.connected = false;
			for (const fn of this.connectionListeners) fn(false);
			if (!this.intentionalClose) {
				this.scheduleReconnect();
			}
		};
	}

	disconnect(): void {
		this.intentionalClose = true;
		this.stopHeartbeat();
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.ws?.close();
		this.ws = null;
	}

	subscribeScrim(scrimId: string): void {
		const count = this.scrimSubscriptions.get(scrimId) ?? 0;
		this.scrimSubscriptions.set(scrimId, count + 1);
		this.connect();
		if (count === 0) {
			this.sendCommand({ type: "subscribe:scrim", scrimId });
		}
	}

	unsubscribeScrim(scrimId: string): void {
		const count = this.scrimSubscriptions.get(scrimId) ?? 0;
		if (count <= 1) {
			this.scrimSubscriptions.delete(scrimId);
			this.sendCommand({ type: "unsubscribe:scrim", scrimId });
			return;
		}
		this.scrimSubscriptions.set(scrimId, count - 1);
	}

	subscribeTeam(teamId: string): void {
		const count = this.teamSubscriptions.get(teamId) ?? 0;
		this.teamSubscriptions.set(teamId, count + 1);
		this.connect();
		if (count === 0) {
			this.sendCommand({ type: "subscribe:team", teamId });
		}
	}

	unsubscribeTeam(teamId: string): void {
		const count = this.teamSubscriptions.get(teamId) ?? 0;
		if (count <= 1) {
			this.teamSubscriptions.delete(teamId);
			this.sendCommand({ type: "unsubscribe:team", teamId });
			return;
		}
		this.teamSubscriptions.set(teamId, count - 1);
	}

	subscribeOrg(organizationId: string): void {
		const count = this.orgSubscriptions.get(organizationId) ?? 0;
		this.orgSubscriptions.set(organizationId, count + 1);
		this.connect();
		if (count === 0) {
			this.sendCommand({ type: "subscribe:org", organizationId });
		}
	}

	unsubscribeOrg(organizationId: string): void {
		const count = this.orgSubscriptions.get(organizationId) ?? 0;
		if (count <= 1) {
			this.orgSubscriptions.delete(organizationId);
			this.sendCommand({ type: "unsubscribe:org", organizationId });
			return;
		}
		this.orgSubscriptions.set(organizationId, count - 1);
	}

	subscribeConversation(conversationId: string): void {
		const count = this.conversationSubscriptions.get(conversationId) ?? 0;
		this.conversationSubscriptions.set(conversationId, count + 1);
		this.connect();
		if (count === 0) {
			this.sendCommand({ type: "subscribe", conversationId });
		}
	}

	unsubscribeConversation(conversationId: string): void {
		const count = this.conversationSubscriptions.get(conversationId) ?? 0;
		if (count <= 1) {
			this.conversationSubscriptions.delete(conversationId);
			this.sendCommand({ type: "unsubscribe", conversationId });
			return;
		}
		this.conversationSubscriptions.set(conversationId, count - 1);
	}

	sendTypingStart(conversationId: string): void {
		this.sendCommand({ type: "typing:start", conversationId });
	}

	sendTypingStop(conversationId: string): void {
		this.sendCommand({ type: "typing:stop", conversationId });
	}

	addListener(listener: RealtimeListener): () => void {
		this.listeners.add(listener);
		this.connect();
		return () => {
			this.listeners.delete(listener);
		};
	}

	addConnectionListener(fn: (connected: boolean) => void): () => void {
		this.connectionListeners.add(fn);
		fn(this.connected);
		return () => {
			this.connectionListeners.delete(fn);
		};
	}

	private sendCommand(command: RealtimeClientCommand): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(JSON.stringify(command));
	}

	private scheduleReconnect(): void {
		if (this.reconnectTimer) return;
		const delay = Math.min(BASE_RECONNECT_MS * 2 ** this.reconnectAttempts, MAX_RECONNECT_MS);
		this.reconnectAttempts++;
		this.reconnectTimer = setTimeout(() => {
			this.reconnectTimer = null;
			this.connect();
		}, delay);
	}

	private startHeartbeat(): void {
		this.stopHeartbeat();
		this.heartbeatTimer = setInterval(() => {
			this.sendCommand({ type: "ping" });
			this.sendCommand({ type: "presence:heartbeat" });
		}, HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private handleEvent(event: RealtimeEvent): void {
		if (
			event.type === "realtime:session-invalidated" ||
			event.type === "chat:session-invalidated"
		) {
			this.disconnect();
			if (typeof window !== "undefined") {
				window.location.reload();
			}
			return;
		}

		if (event.type === "realtime:access-revoked") {
			if (event.scope === "team") {
				this.teamSubscriptions.delete(event.teamId);
				for (const scrimId of event.scrimIds ?? []) {
					this.scrimSubscriptions.delete(scrimId);
				}
			} else {
				this.orgSubscriptions.delete(event.organizationId);
			}
		}

		this.applyChatEvent(event);

		for (const listener of this.listeners) {
			listener(event);
		}
	}

	/** Route chat-domain events into the chat store (no-op for app-domain events). */
	private applyChatEvent(event: RealtimeEvent): void {
		const store = useChatStore.getState();

		switch (event.type) {
			case "message:new":
				store.appendMessage(event.conversationId, event.message);
				break;
			case "message:updated":
				store.updateMessage(event.conversationId, event.message);
				break;
			case "message:deleted":
				store.deleteMessage(event.conversationId, event.messageId, event.deletedAt);
				break;
			case "conversation:message-updated":
				store.updateMessage(event.conversationId, event.message, event.conversation);
				break;
			case "conversation:message-deleted":
				store.deleteMessage(
					event.conversationId,
					event.messageId,
					event.deletedAt,
					event.conversation
				);
				break;
			case "typing:start":
				store.setTyping(event.conversationId, event.userId, true);
				break;
			case "typing:stop":
				store.setTyping(event.conversationId, event.userId, false);
				break;
			case "presence:update":
				store.setPresence(event.presence);
				break;
			case "notification:new":
				store.upsertConversation(event.conversation);
				if (store.messages[event.conversationId]) {
					store.appendMessage(event.conversationId, event.message);
				}
				break;
			case "conversation:message-created":
				store.upsertConversation(event.conversation);
				if (store.messages[event.conversationId]) {
					store.appendMessage(event.conversationId, event.message);
				}
				break;
			case "conversation:access-revoked":
				store.removeConversations(event.conversationIds);
				for (const conversationId of event.conversationIds) {
					this.conversationSubscriptions.delete(conversationId);
					this.sendCommand({ type: "unsubscribe", conversationId });
				}
				break;
			default:
				break;
		}
	}
}

export const realtimeSocket = new RealtimeSocketService();
