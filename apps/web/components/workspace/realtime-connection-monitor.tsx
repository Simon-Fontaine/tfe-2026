"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";

export function RealtimeConnectionMonitor() {
	const router = useRouter();
	const [appConnected, setAppConnected] = useState(true);
	const [justReconnected, setJustReconnected] = useState(false);

	const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const reconnectBannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const hasEverConnectedApp = useRef(false);
	const hasEverDisconnectedApp = useRef(false);

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

		const removeAppListener = realtimeSocket.addConnectionListener((connected) => {
			if (connected) {
				hasEverConnectedApp.current = true;
			}
			if (!connected && hasEverConnectedApp.current) {
				hasEverDisconnectedApp.current = true;
			}
			if (connected && hasEverDisconnectedApp.current) {
				scheduleRefresh();
				setJustReconnected(true);
				if (reconnectBannerTimerRef.current) clearTimeout(reconnectBannerTimerRef.current);
				reconnectBannerTimerRef.current = setTimeout(() => {
					reconnectBannerTimerRef.current = null;
					setJustReconnected(false);
				}, 2000);
			}
			setAppConnected(connected);
		});

		return () => {
			removeAppListener();
			if (refreshTimerRef.current) {
				clearTimeout(refreshTimerRef.current);
				refreshTimerRef.current = null;
			}
			if (reconnectBannerTimerRef.current) {
				clearTimeout(reconnectBannerTimerRef.current);
				reconnectBannerTimerRef.current = null;
			}
		};
	}, [router]);

	if (!appConnected) {
		return (
			<div className="border-b border-yellow-500/20 bg-yellow-500/5 px-4 py-1.5 text-xs text-yellow-600 dark:text-yellow-400">
				Reconnecting to live updates…
			</div>
		);
	}

	if (justReconnected) {
		return (
			<div className="border-b border-green-500/20 bg-green-500/5 px-4 py-1.5 text-xs text-green-600 dark:text-green-400">
				Live updates restored
			</div>
		);
	}

	return null;
}
