"use client";

import { useEffect } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";

/**
 * Ensures the shared realtime websocket is connected while chat UI is mounted.
 *
 * The socket is a session-wide singleton shared with inbox / scrim / updates
 * bridges, so this only opens the connection — it never tears it down on unmount.
 */
export function useChatSocket(): void {
	useEffect(() => {
		realtimeSocket.connect();
	}, []);
}
