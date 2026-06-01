"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { useScrimStore } from "@/stores/scrims";

interface ScrimsStoreBootstrapProps {
	teamId: string;
	needsActionCount: number;
}

export function ScrimsStoreBootstrap({ teamId, needsActionCount }: ScrimsStoreBootstrapProps) {
	const router = useRouter();
	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const wasDisconnectedRef = useRef(false);
	const hydrateNeedsActionCount = useScrimStore((state) => state.hydrateNeedsActionCount);
	const resetNeedsActionCount = useScrimStore((state) => state.resetNeedsActionCount);

	useEffect(() => {
		hydrateNeedsActionCount(teamId, needsActionCount);
		return () => {
			resetNeedsActionCount();
		};
	}, [teamId, needsActionCount, hydrateNeedsActionCount, resetNeedsActionCount]);

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
			if (event.type !== "scrim:changed" || event.teamId !== teamId) return;
			scheduleRefresh();
		}

		realtimeSocket.subscribeTeam(teamId);
		const removeListener = realtimeSocket.addListener(handleEvent);
		const removeConnectionListener = realtimeSocket.addConnectionListener((connected) => {
			if (!connected) {
				wasDisconnectedRef.current = true;
				return;
			}
			if (!wasDisconnectedRef.current) return;
			wasDisconnectedRef.current = false;
			scheduleRefresh();
		});

		return () => {
			removeListener();
			removeConnectionListener();
			realtimeSocket.unsubscribeTeam(teamId);
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
		};
	}, [router, teamId]);

	return null;
}
