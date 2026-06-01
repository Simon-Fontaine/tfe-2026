import type { RealtimeSessionInvalidationReason } from "@scrimflow/shared";
import { validateSessionById } from "@/auth/session";

export type WsRouteSocket = {
	send: (value: string) => void;
	close?: (code?: number, reason?: string) => void;
};

export type WsErrorCode =
	| "access_denied"
	| "internal_error"
	| "invalid_payload"
	| "missing_field"
	| "session_invalid";

export function createWsSessionGuard(
	sessionId: string,
	disconnectFn: (sessionId: string, reason: RealtimeSessionInvalidationReason) => void
) {
	return async function ensureActiveSession(): Promise<boolean> {
		const validation = await validateSessionById(sessionId);
		if (validation.valid) return true;
		disconnectFn(sessionId, validation.reason);
		return false;
	};
}

export function parseWsCommand<T>(
	raw: string,
	ws: WsRouteSocket,
	sendError: (
		ws: WsRouteSocket,
		params: { error: string; code: WsErrorCode; retryable: boolean }
	) => void
): T | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		sendError(ws, {
			error: "Invalid websocket payload.",
			code: "invalid_payload",
			retryable: false,
		});
		return null;
	}
	if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
		sendError(ws, {
			error: "Invalid websocket payload.",
			code: "invalid_payload",
			retryable: false,
		});
		return null;
	}
	return parsed as T;
}
