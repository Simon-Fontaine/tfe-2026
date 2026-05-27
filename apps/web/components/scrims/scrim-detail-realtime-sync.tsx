"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";

interface ScrimDetailRealtimeSyncProps {
	scrimId: string;
}

export function ScrimDetailRealtimeSync({ scrimId }: ScrimDetailRealtimeSyncProps) {
	const router = useRouter();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		function scheduleRefresh() {
			if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
			refreshTimerRef.current = setTimeout(() => {
				refreshTimerRef.current = null;
				startTransition(() => {
					router.refresh();
				});
			}, 500);
		}

		function handleEvent(event: AppRealtimeEvent) {
			if (event.type !== "scrim:status-changed") return;
			if (event.scrimId !== scrimId) return;
			scheduleRefresh();
		}

		realtimeSocket.subscribeScrim(scrimId);
		const removeListener = realtimeSocket.addListener(handleEvent);

		return () => {
			removeListener();
			realtimeSocket.unsubscribeScrim(scrimId);
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
		};
	}, [scrimId, router]);

	return null;
}
