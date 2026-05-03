"use client";

import { useEffect } from "react";
import { useScrimStore } from "@/stores/scrims";

interface ScrimsStoreBootstrapProps {
	needsActionCount: number;
}

export function ScrimsStoreBootstrap({ needsActionCount }: ScrimsStoreBootstrapProps) {
	const hydrateNeedsActionCount = useScrimStore((state) => state.hydrateNeedsActionCount);
	const resetNeedsActionCount = useScrimStore((state) => state.resetNeedsActionCount);

	useEffect(() => {
		hydrateNeedsActionCount(needsActionCount);
		return () => {
			resetNeedsActionCount();
		};
	}, [needsActionCount, hydrateNeedsActionCount, resetNeedsActionCount]);

	return null;
}
