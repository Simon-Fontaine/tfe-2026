import type { AppRealtimeClientCommand, AppRealtimeEvent } from "@scrimflow/shared";
import { apiRoutes } from "@/lib/routes";

type RealtimeListener = (event: AppRealtimeEvent) => void;

const BASE_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

class RealtimeSocketService {
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	private intentionalClose = false;
	private scrimSubscriptions = new Set<string>();
	private teamSubscriptions = new Set<string>();
	private listeners = new Set<RealtimeListener>();

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
			for (const scrimId of this.scrimSubscriptions) {
				this.sendCommand({ type: "subscribe:scrim", scrimId });
			}
			for (const teamId of this.teamSubscriptions) {
				this.sendCommand({ type: "subscribe:team", teamId });
			}
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
			if (!this.intentionalClose) {
				this.scheduleReconnect();
			}
		};
	}

	disconnect(): void {
		this.intentionalClose = true;
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer);
			this.reconnectTimer = null;
		}
		this.ws?.close();
		this.ws = null;
	}

	subscribeScrim(scrimId: string): void {
		this.scrimSubscriptions.add(scrimId);
		this.connect();
		this.sendCommand({ type: "subscribe:scrim", scrimId });
	}

	unsubscribeScrim(scrimId: string): void {
		this.scrimSubscriptions.delete(scrimId);
		this.sendCommand({ type: "unsubscribe:scrim", scrimId });
	}

	subscribeTeam(teamId: string): void {
		this.teamSubscriptions.add(teamId);
		this.connect();
		this.sendCommand({ type: "subscribe:team", teamId });
	}

	unsubscribeTeam(teamId: string): void {
		this.teamSubscriptions.delete(teamId);
		this.sendCommand({ type: "unsubscribe:team", teamId });
	}

	addListener(listener: RealtimeListener): () => void {
		this.listeners.add(listener);
		this.connect();
		return () => {
			this.listeners.delete(listener);
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

	private handleEvent(event: AppRealtimeEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}
}

export const realtimeSocket = new RealtimeSocketService();
