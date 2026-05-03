"use client";

import { useEffect } from "react";
import { useScrimStore } from "@/stores/scrims";

interface ScrimsStoreBootstrapProps {
	needsActionCount: number;
}

export function ScrimsStoreBootstrap({ needsActionCount }: ScrimsStoreBootstrapProps) {
	const hydrateNeedsActionCount = useScrimStore((state) => state.hydrateNeedsActionCount);

	useEffect(() => {
		hydrateNeedsActionCount(needsActionCount);
	}, [needsActionCount, hydrateNeedsActionCount]);

	return null;
}
