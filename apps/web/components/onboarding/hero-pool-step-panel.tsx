"use client";

import { ArrowLeft01Icon, GameController01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useState } from "react";

import { createPlayerProfileAction } from "@/app/onboarding/actions";
import { AuthPanelHeader } from "@/components/shared/auth-panel-header";
import { HeroPoolPicker } from "@/components/shared/hero-pool-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useOnboardingAction } from "@/hooks/use-onboarding-action";
import type { HeroRow } from "@/lib/data/heroes";
import { useOnboardingFlow } from "@/stores/onboarding-flow";

interface HeroPoolStepPanelProps {
	heroes: HeroRow[];
}

export function HeroPoolStepPanel({ heroes }: HeroPoolStepPanelProps) {
	const { transitionTo, data } = useOnboardingFlow();
	const [selectedHeroes, setSelectedHeroes] = useState<Set<string>>(new Set(data.heroPool));
	const [heroError, setHeroError] = useState<string | null>(null);

	const { submit, isPending } = useOnboardingAction(createPlayerProfileAction, {
		loadingMessage: "Setting up your profile…",
		successMessage: "Profile set up!",
	});

	function toggleHero(heroId: string) {
		setHeroError(null);
		setSelectedHeroes((prev) => {
			const next = new Set(prev);
			if (next.has(heroId)) next.delete(heroId);
			else next.add(heroId);
			return next;
		});
	}

	function handleFinish() {
		if (selectedHeroes.size === 0) {
			setHeroError("Please select at least one hero");
			return;
		}

		const formData = new FormData();
		if (data.battletag) formData.set("battletag", data.battletag);
		if (!data.primaryRole) return; // guard: cannot reach this step without a role
		formData.set("primaryRole", data.primaryRole);
		if (data.secondaryRole) formData.set("secondaryRole", data.secondaryRole);
		if (data.rank) formData.set("rank", data.rank);
		if (data.rankDivision !== null && data.rankDivision !== undefined) {
			formData.set("rankDivision", String(data.rankDivision));
		}
		for (const hero of selectedHeroes) formData.append("heroPool[]", hero);

		submit(formData);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-start justify-between">
				<AuthPanelHeader
					icon={GameController01Icon}
					title="Your hero pool"
					subtitle="Select the heroes you're comfortable playing in scrims."
				/>
				{selectedHeroes.size > 0 && (
					<span className="shrink-0 text-[10px] text-muted-foreground">
						{selectedHeroes.size} selected
					</span>
				)}
			</div>

			<HeroPoolPicker
				heroes={heroes}
				selectedHeroes={selectedHeroes}
				onToggle={toggleHero}
				disabled={isPending}
				maxHeight="max-h-[320px]"
				gridCols="grid-cols-4 sm:grid-cols-5 md:grid-cols-6"
			/>

			{heroError && <p className="text-xs text-destructive">{heroError}</p>}

			<div className="flex gap-2">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => transitionTo("roles-and-rank", { heroPool: [...selectedHeroes] })}
					disabled={isPending}
					className="gap-1.5"
				>
					<HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={2} className="size-3.5" />
					Back
				</Button>
				<Button type="button" onClick={handleFinish} disabled={isPending} className="flex-1">
					{isPending && <Spinner className="mr-1.5" />}
					Finish setup
				</Button>
			</div>
		</div>
	);
}
