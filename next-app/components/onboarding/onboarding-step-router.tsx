"use client";

import { useEffect, useRef } from "react";

import type { HeroRow } from "@/lib/data/heroes";
import { useOnboardingFlow } from "@/stores/onboarding-flow";
import { BattletagStepPanel } from "./battletag-step-panel";
import { HeroPoolStepPanel } from "./hero-pool-step-panel";
import { RolesAndRankStepPanel } from "./roles-rank-step-panel";

interface OnboardingStepRouterProps {
	heroes: HeroRow[];
}

export function OnboardingStepRouter({ heroes }: OnboardingStepRouterProps) {
	const { step } = useOnboardingFlow();
	const containerRef = useRef<HTMLDivElement>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: step is used intentionally as a trigger to re-focus on navigation
	useEffect(() => {
		containerRef.current?.focus();
	}, [step]);

	function renderStep() {
		switch (step) {
			case "battletag":
				return <BattletagStepPanel />;
			case "roles-and-rank":
				return <RolesAndRankStepPanel />;
			case "hero-pool":
				return <HeroPoolStepPanel heroes={heroes} />;
			default:
				return <BattletagStepPanel />;
		}
	}

	return (
		<div ref={containerRef} tabIndex={-1} className="outline-none">
			{renderStep()}
		</div>
	);
}
