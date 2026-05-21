"use client";

import { useEffect } from "react";
import { useScrimStore } from "@/stores/scrims";

interface ScrimsStoreBootstrapProps {
	teamId: string;
	needsActionCount: number;
}

export function ScrimsStoreBootstrap({ teamId, needsActionCount }: ScrimsStoreBootstrapProps) {
	const hydrateNeedsActionCount = useScrimStore((state) => state.hydrateNeedsActionCount);
	const resetNeedsActionCount = useScrimStore((state) => state.resetNeedsActionCount);

	useEffect(() => {
		hydrateNeedsActionCount(teamId, needsActionCount);
		return () => {
			resetNeedsActionCount();
		};
	}, [teamId, needsActionCount, hydrateNeedsActionCount, resetNeedsActionCount]);

	return null;
}
