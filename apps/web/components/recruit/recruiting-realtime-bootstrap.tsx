"use client";

import type { AppRealtimeEvent } from "@scrimflow/shared";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { realtimeSocket } from "@/lib/ws/realtime-socket";
import { useRecruitingStore } from "@/stores/recruiting";

interface RecruitingRealtimeBootstrapProps {
	initialPendingCount: number;
}

export function RecruitingRealtimeBootstrap({
	initialPendingCount,
}: RecruitingRealtimeBootstrapProps) {
	const router = useRouter();
	const pathname = usePathname();

	useEffect(() => {
		useRecruitingStore.getState().hydratePendingApplicationCount(initialPendingCount);
	}, [initialPendingCount]);

	useEffect(() => {
		const remove = realtimeSocket.addListener((event: AppRealtimeEvent) => {
			if (event.type === "recruit:managed-pending-count") {
				useRecruitingStore.getState().setPendingApplicationCount(event.pendingCount);
			}

			if (
				pathname?.includes("/recruiting") &&
				(event.type === "recruit:application-received" ||
					event.type === "recruit:application-decided" ||
					event.type === "recruit:managed-pending-count")
			) {
				router.refresh();
			}
		});
		return () => remove();
	}, [pathname, router]);

	return null;
}
