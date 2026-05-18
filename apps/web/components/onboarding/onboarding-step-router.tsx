"use client";

import type { OnboardingProgress } from "@scrimflow/shared";
import { useEffect, useRef } from "react";
import { ErrorStateBlock } from "@/components/shared/error-state-block";
import type { HeroRow } from "@/lib/data/heroes";
import { useOnboardingFlow } from "@/stores/onboarding-flow";
import { BattletagStepPanel } from "./battletag-step-panel";
import { HeroPoolStepPanel } from "./hero-pool-step-panel";
import { IntentStepPanel } from "./intent-step-panel";
import { OnboardingCompletePanel } from "./onboarding-complete-panel";
import { RolesAndRankStepPanel } from "./roles-rank-step-panel";

interface OnboardingStepRouterProps {
	heroes: HeroRow[];
	initialProgress: OnboardingProgress;
	nextDestination?: string | null;
	progressLoadError?: string | null;
}

export function OnboardingStepRouter({
	heroes,
	initialProgress,
	nextDestination,
	progressLoadError,
}: OnboardingStepRouterProps) {
	const { step, hydrate, hydrated, hydratedProgressKey } = useOnboardingFlow();
	const containerRef = useRef<HTMLDivElement>(null);
	const progressKey = `${initialProgress.updatedAt ?? "empty"}:${initialProgress.currentStep}`;

	useEffect(() => {
		if (!progressLoadError && hydratedProgressKey !== progressKey) {
			hydrate(initialProgress, progressKey);
		}
	}, [hydrate, hydratedProgressKey, initialProgress, progressKey, progressLoadError]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: step is used intentionally as a trigger to re-focus on navigation
	useEffect(() => {
		containerRef.current?.focus();
	}, [step]);

	function renderStep() {
		if (progressLoadError) {
			return (
				<ErrorStateBlock message={progressLoadError} onRetry={() => window.location.reload()} />
			);
		}
		if (!hydrated || hydratedProgressKey !== progressKey) return null;

		switch (step) {
			case "battletag":
				return <BattletagStepPanel />;
			case "roles-and-rank":
				return <RolesAndRankStepPanel />;
			case "hero-pool":
				return <HeroPoolStepPanel heroes={heroes} />;
			case "intent":
				return <IntentStepPanel nextDestination={nextDestination} />;
			case "complete":
				return <OnboardingCompletePanel />;
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
