"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";

interface RecruitingRealtimeBootstrapProps {
	initialPendingCount: number;
}

export function RecruitingRealtimeBootstrap(_props: RecruitingRealtimeBootstrapProps) {
	const router = useRouter();

	useEffect(() => {
		const remove = realtimeSocket.addListener((event: AppRealtimeEvent) => {
			if (
				event.type === "recruit:application-received" ||
				event.type === "recruit:application-decided"
			) {
				router.refresh();
			}
		});
		return () => remove();
	}, [router]);

	return null;
}
