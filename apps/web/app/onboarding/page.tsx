import type { OnboardingProgress } from "@scrimflow/shared";
import { OnboardingStepRouter } from "@/components/onboarding/onboarding-step-router";
import { apiGet } from "@/lib/api-client";
import { getActiveHeroes } from "@/lib/data/heroes";
import { apiRoutes } from "@/lib/routes";

interface OnboardingPageProps {
	searchParams: Promise<{ next?: string }>;
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
	const { next } = await searchParams;
	const [heroes, progressRes] = await Promise.all([
		getActiveHeroes(),
		apiGet<OnboardingProgress>(apiRoutes.onboarding.progress),
	]);
	const initialProgress =
		"data" in progressRes
			? progressRes.data
			: ({ currentStep: "battletag", data: {}, updatedAt: null } satisfies OnboardingProgress);
	const progressLoadError =
		"error" in progressRes
			? `${progressRes.error} Retry to restore your saved onboarding progress.`
			: null;

	return (
		<OnboardingStepRouter
			heroes={heroes}
			initialProgress={initialProgress}
			nextDestination={next}
			progressLoadError={progressLoadError}
		/>
	);
}
