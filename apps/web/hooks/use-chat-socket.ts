"use client";

import { useEffect } from "react";
import { chatSocket } from "@/lib/ws/chat-socket";

/**
 * Initialises the shared WebSocket connection when the component mounts
 * and tears it down on unmount.
 *
 * Mount this once at the top of the chat UI tree (e.g. ChatWorkspace).
 */
export function useChatSocket(): void {
	useEffect(() => {
		chatSocket.connect();
		return () => {
			chatSocket.disconnect();
		};
	}, []);
}
