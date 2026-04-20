import type { ChatClientCommand, ChatRealtimeEvent } from "@scrimflow/shared";
import { apiRoutes } from "@/lib/routes";
import { useChatStore } from "@/stores/chat";

/**
 * Singleton WebSocket service for real-time chat.
 *
 * One connection is shared across the entire browser session.
 * Reconnects with exponential backoff (1s → 2s → 4s → 8s → max 30s).
 * Sends a presence heartbeat every 30s while connected.
 */

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;

class ChatSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private subscriptions = new Set<string>();
	private intentionalClose = false;

	// ─── Connection ─────────────────────────────────────────────────────────

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
		const url = `${protocol}://${window.location.host}${apiRoutes.chat.ws}`;

		try {
			this.ws = new WebSocket(url);
		} catch {
			this.scheduleReconnect();
			return;
		}

		this.ws.onopen = () => {
			this.reconnectAttempts = 0;
			// Re-subscribe to all active conversations
			for (const conversationId of this.subscriptions) {
				this.sendCommand({ type: "subscribe", conversationId });
			}
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(String(event.data)) as ChatRealtimeEvent;
				this.handleEvent(data);
			} catch {
				// Malformed frame — ignore
			}
		};

		this.ws.onclose = () => {
			this.stopHeartbeat();
			if (!this.intentionalClose) {
				this.scheduleReconnect();
			}
		};

		this.ws.onerror = () => {
			// onerror is always followed by onclose — let onclose handle reconnect
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

	// ─── Subscriptions ───────────────────────────────────────────────────────

	subscribe(conversationId: string): void {
		this.subscriptions.add(conversationId);
		this.connect();
		this.sendCommand({ type: "subscribe", conversationId });
	}

	unsubscribe(conversationId: string): void {
		this.subscriptions.delete(conversationId);
		this.sendCommand({ type: "unsubscribe", conversationId });
	}

	// ─── Typing ──────────────────────────────────────────────────────────────

	sendTypingStart(conversationId: string): void {
		this.sendCommand({ type: "typing:start", conversationId });
	}

	sendTypingStop(conversationId: string): void {
		this.sendCommand({ type: "typing:stop", conversationId });
	}

	// ─── Internal ────────────────────────────────────────────────────────────

	private sendCommand(command: ChatClientCommand): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
		this.ws.send(JSON.stringify(command));
	}

	private scheduleReconnect(): void {
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
			this.sendCommand({ type: "presence:heartbeat" });
		}, HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private handleEvent(event: ChatRealtimeEvent): void {
		if (event.type === "chat:session-invalidated") {
			this.disconnect();
			if (typeof window !== "undefined") {
				window.location.reload();
			}
			return;
		}

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

			case "message:read":
				// Another participant read messages — update their unread state if needed
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
				break;

			default:
				// chat:connected, chat:pong, chat:error, conversation:subscribed, etc.
				break;
		}
	}
}

export const chatSocket = new ChatSocketService();
