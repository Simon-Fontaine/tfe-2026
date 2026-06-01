import type { AppRealtimeClientCommand, AppRealtimeEvent } from "@scrimflow/shared";
import { apiRoutes } from "@/lib/routes";

type RealtimeListener = (event: AppRealtimeEvent) => void;

const BASE_RECONNECT_MS = 1_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_RECONNECT_MS = 30_000;

class RealtimeSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
	private intentionalClose = false;
	private scrimSubscriptions = new Map<string, number>();
	private teamSubscriptions = new Map<string, number>();
	private orgSubscriptions = new Map<string, number>();
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
			this.connected = true;
			for (const fn of this.connectionListeners) fn(true);
			this.startHeartbeat();
		};

		this.ws.onmessage = (event) => {
			try {
				const data = JSON.parse(String(event.data)) as AppRealtimeEvent;
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

	private sendCommand(command: AppRealtimeClientCommand): void {
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
		}, HEARTBEAT_INTERVAL_MS);
	}

	private stopHeartbeat(): void {
		if (this.heartbeatTimer) {
			clearInterval(this.heartbeatTimer);
			this.heartbeatTimer = null;
		}
	}

	private handleEvent(event: AppRealtimeEvent): void {
		if (event.type === "realtime:session-invalidated") {
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

		for (const listener of this.listeners) {
			listener(event);
		}
	}
}

export const realtimeSocket = new RealtimeSocketService();
