import { OnboardingStepRouter } from "@/components/onboarding/onboarding-step-router";
import { getActiveHeroes } from "@/lib/data/heroes";

export default async function OnboardingPage() {
	const heroes = await getActiveHeroes();
	return <OnboardingStepRouter heroes={heroes} />;
}
