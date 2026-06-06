"use client";

import { useEffect } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";

/**
 * Opens the shared realtime websocket while chat UI is mounted. The socket is a
 * session-wide singleton, so this never tears it down on unmount.
 */
export function useChatSocket(): void {
	useEffect(() => {
		realtimeSocket.connect();
	}, []);
}
